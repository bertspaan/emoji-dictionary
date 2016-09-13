const fs = require('fs')
const path = require('path')
const H = require('highland')
const parse = require('csv-parse')
const Handlebars = require('handlebars')
const emojiData = require('./emoji.json')
const roman = require('roman-numerals')

const template = Handlebars.compile(fs.readFileSync('template.html', 'utf8'))
const parser = parse({delimiter: ','})

var emojiUnified = {}
emojiData.forEach((emoji) => {
  emojiUnified[emoji.unified.toLowerCase()] = emoji
})

const INCH_DIMENSIONS = [
  7.5,
  7.5
]
const EMOJIS_PER_VOLUME = 185

const EMOJI_PNG_URL = 'https://raw.githubusercontent.com/iamcal/emoji-data/master/img-apple-160/'
var stream = fs.createReadStream('NYPL DEC- Digital Emoji Collections - complete.csv', 'utf8')
  .pipe(parser)

String.prototype.toCodePoints = function() {
  chars = [];
  for (var i= 0; i<this.length; i++) {
    var c1 = this.charCodeAt(i)
    if (c1 >= 0xD800 && c1<0xDC00 && i+1 < this.length) {
      var c2= this.charCodeAt(i+1)
      if (c2>=0xDC00 && c2<0xE000) {
        chars.push(0x10000 + ((c1-0xD800)<<10) + (c2-0xDC00))
        i++
        continue
      }
    }
    chars.push(c1)
  }
  return chars
}

const NYPL_LABS = ['🏛', '🦁', '🗽', '💾']
  .map((emoji) => emoji.toCodePoints())
  .map((codePoints) => codePoints[0].toString(16))
  .map((codePoint) => emojiUnified[codePoint])
  .map((data) => ({
    png: `${EMOJI_PNG_URL}${data.image}`
  }))

const EXCLUDE_NAMES = [
  'black medium square',
  'black medium small square'
]

function createVolume(volume) {
  console.log(`Volume ${volume.volume} - ${volume.emojis.length} emoji, ${volume.emojis.length * 2 + 1} pages`)
  const html = template(volume)
  fs.writeFileSync(path.join(__dirname, 'volumes', `${volume.volume}.html`), html, 'utf8')
}

var volume = 0
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
    const codePoints = emoji.emoji.toCodePoints()

    if (codePoints.length !== 1) {
      console.error('Multiple code points... WHAT TO DO?', codePoints, emoji.emoji)
    }

    const codePoint = codePoints[0].toString(16)
    const data = emojiUnified[codePoint]

    if (data) {
      const name = data.short_name.replace(/_/g, ' ')

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
  .sortBy((a, b) => b.name < a.name ? 1 : -1)
  .batch(EMOJIS_PER_VOLUME)
  .map((emojis) => ({
    volume: volume += 1,
    romanVolume: roman.toRoman(volume),
    emojis: emojis,
    from: emojis[0],
    to: emojis[emojis.length - 1],
    nyplLabs: NYPL_LABS
  }))
  .map(createVolume)
  .done(() => {
    console.log('Done!')
  })
