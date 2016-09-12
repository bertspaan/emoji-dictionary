const fs = require('fs')
const H = require('highland')
const parse = require('csv-parse')
const Handlebars = require('handlebars')
const emojiData = require('./emoji.json')

const template = Handlebars.compile(fs.readFileSync('template.html', 'utf8'))
const parser = parse({delimiter: ','})

var emojiUnified = {}
emojiData.forEach((emoji) => {
  emojiUnified[emoji.unified.toLowerCase()] = emoji
})

const EMOJI_PNG_URL = 'https://raw.githubusercontent.com/iamcal/emoji-data/master/img-apple-160/'
var stream = fs.createReadStream('NYPL DEC- Digital Emoji Collections - complete.csv', 'utf8')
  .pipe(parser)

String.prototype.toCodePoints = function() {
    chars = [];
    for (var i= 0; i<this.length; i++) {
        var c1= this.charCodeAt(i);
        if (c1>=0xD800 && c1<0xDC00 && i+1<this.length) {
            var c2= this.charCodeAt(i+1);
            if (c2>=0xDC00 && c2<0xE000) {
                chars.push(0x10000 + ((c1-0xD800)<<10) + (c2-0xDC00));
                i++;
                continue;
            }
        }
        chars.push(c1);
    }
    return chars;
}

const NYPL_LABS = ['🏛', '🦁', '🗽', '💾']
  .map((emoji) => emoji.toCodePoints())
  .map((codePoints) => codePoints[0].toString(16))
  .map((codePoint) => emojiUnified[codePoint])
  .map((data) => ({
    png: `${EMOJI_PNG_URL}${data.image}`
  }))

const EXCLUDE_NAMES = [
  'u5272',
  'u5408',
  'u55b6',
  'u6307',
  'u6708',
  'u6709',
  'u6e80',
  'u7121',
  'u7533',
  'u7981',
  'u7a7a'
]


// jack o lantern
// ends with 2, remove 2
// clock12 => clock 12:00

H(stream)
  .drop(2)
  .map((row) => ({
    unicode: row[0],
    name: row[1],
    emoji: row[2],
    imageId: row[3],
    uuid: row[5]
  }))
  .filter((emoji) => emoji.imageId)
  .filter((emoji) => emoji.emoji)
  .map((emoji) => {
    // const unified = emoji.unicode
    //   .toLowerCase()
    //   .replace(/"/g, '')
    //   .split('\\u').filter((hex) => hex.length)
    //   .join('-')

    const codePoints = emoji.emoji.toCodePoints()

    if (codePoints.length !== 1) {
      console.error('Multiple code points... WHAT TO DO?', codePoints, emoji.emoji)
    }

    const codePoint = codePoints[0].toString(16)
    const data = emojiUnified[codePoint]

    if (data) {
      const name = data.short_name.replace(/_/g, ' ')

      // console.error(data)
      return Object.assign(emoji, {
        png: `${EMOJI_PNG_URL}${data.image}`,
        name: name,
        shortName: data.short_name,
        uuid: emoji.uuid.replace('http://digitalcollections.nypl.org/items/', '')
      })
    } else {
      return null
    }
  })
  .stopOnError(console.error)
  .compact()
  .filter((emoji) => EXCLUDE_NAMES.indexOf(emoji.name) === -1)
  // .drop(10)
  .take(100)
  .sortBy(function (a, b) {
    return b.name < a.name ? 1 : -1
  })
  .toArray((emojis) => {
    console.error(`👯  ${emojis.length} emojis done!`)
    console.log(template({
      emojis,
      nyplLabs: NYPL_LABS
    }))
  })
