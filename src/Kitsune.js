const { Collection } = require('@discordjs/collection')
/**
* Returns the index of the last element in the array where predicate is true, and -1
* otherwise.
* @param array The source array to search in
* @param predicate find calls predicate once for each element of the array, in descending
* order, until it finds one where predicate returns true. If such an element is found,
* findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
*/
function findLastIndex (array, predicate) {
  let l = array.length
  while (l--) {
    if (predicate(array[l], l, array)) { return l }
  }
  return -1
}

class KitsuneParserError extends Error {
  constructor (m) {
    super(m)
    this.name = 'KitsuneParserError'
  }
}

class KitsuneParserArgumentError extends KitsuneParserError {
  /**
     * Argument error of KitsuneParser
     *
     * @param {*} value value of argument
     * @param {number} index index of argument
     * @param {string} type type of argument
     * @param {string=} message additional message
     */
  constructor (value, index, type, message) {
    super(message || undefined)
    this.value = value
    this.index = index
    this.type = type
    if (message) this.message = message
  }
}

class KitsuneParserMessageError extends Error {
  /**
     * Message error of KitsuneParser.
     *
     * @param {String} message message
     */
  constructor (message) {
    super(message)
    this.message = message
  }
}

class KitsuneParserType {
  constructor ({
    name,
    info,
    exec,
    check
  }) {
    this.name = name
    this.info = info
    this.exec = exec
    this.check = check
  }
}
/**
 * KitsuneParser
 *
 * Used for advanced commands with parsing arguments.
 */
class KitsuneParser {
  constructor () {
    this.types = new Collection([
      ['string', new KitsuneParserType({
        name: 'string',
        info: 'String',
        check: val => typeof val === 'string' || val instanceof String,
        exec: val => String(val)
      })],
      ['number', new KitsuneParserType({
        name: 'number',
        info: 'Number',
        check: val => !isNaN(val) || typeof val === 'number' || val instanceof Number,
        exec: val => parseInt(val)
      })]
    ])
  }

  addType ({
    name,
    info,
    exec,
    check
  }) {
    if (!name || !exec || !check) {
      throw new KitsuneParserMessageError('Cannot add type. No name, execution or checker.')
    }

    this.types.set(name, new KitsuneParserType({
      name,
      info,
      exec,
      check
    }))
  }

  findType (type) {
    return this.types.find((_v, key) => type === key)
  }

  removeType (type) {
    const findedType = this.findType(type)
    this.types.delete(findedType)
  }

  parseType (typeName, val, options) {
    const type = this.findType(typeName)
    const check = type.check(val, options)
    return check ? { value: type.exec(val, options) } : { check }
  }

  parse (args, usage) {
    const parsed = []
    if (!Array.isArray(usage)) {
      throw new KitsuneParserMessageError('Parser arguments must be an array.')
    }

    // required key fix
    /*
        args = args.map(arg => {
            arg.required = arg.required === undefined ? true : arg.required
            return arg
        })
        */
    const requiredArray = args.map(arg => arg.required)

    const len = requiredArray.filter(val => val === false).length
    const pos = findLastIndex(requiredArray, val => val === false)

    if (len > 1) {
      throw new KitsuneParserArgumentError(undefined, pos, undefined, 'Non-required argument must be only one.')
    }

    if (pos < requiredArray.length - 1 && pos !== -1) {
      throw new KitsuneParserArgumentError(undefined, pos, undefined, 'Non-required argument must be at the end of the arguments array.')
    }
    //

    let usageIndex = 0

    usage.forEach(({ type, required, count, ...otherOptions }) => {
      const argToParse = count ? args.slice(usageIndex, usageIndex + count) : args[usageIndex]
      let result

      if (!Array.isArray(type)) {
        if (!Array.isArray(argToParse)) { result = this.parseType(type, argToParse, otherOptions) } else {
          result = argToParse.map(arg => {
            return this.parseType(type, arg, otherOptions)
          })
        }
      } else {
        let isParsed = false

        type.some(typeName => {
          let resultType

          if (!Array.isArray(argToParse)) { resultType = this.parseType(typeName, argToParse, otherOptions) } else {
            resultType = argToParse.map(arg => {
              return this.parseType(typeName, arg, otherOptions)
            })
          }

          if (resultType) {
            result = resultType
            isParsed = true
            return true
          }

          return false
        })

        if (!isParsed) {
          throw new KitsuneParserArgumentError(argToParse, usageIndex, type)
        }
      }

      if (Array.isArray(result)) {
        const indices = result.flatMap((bool, index) => bool.check === undefined ? [] : index)

        if (indices.length) {
          throw new KitsuneParserArgumentError(argToParse[indices[0]], usageIndex + indices[0], type)
        }

        if (result.length < count) {
          throw new KitsuneParserArgumentError(argToParse, usageIndex, type, 'Passed arguments count is not equal to type count.')
        }
      }

      if (result.check !== undefined && required) {
        throw new KitsuneParserArgumentError(argToParse, usageIndex, type)
      }

      parsed.push(Array.isArray(result) ? result.map(e => e.value) : result.value)
      count ? usageIndex += count : usageIndex++
    })

    return parsed
  }
}

module.exports = {
  KitsuneParserError, // Use only for instanceof
  KitsuneParserArgumentError,
  KitsuneParserMessageError,
  KitsuneParserType, // Don't use directly
  KitsuneParser
}
