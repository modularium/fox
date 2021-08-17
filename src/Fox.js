const { Collection } = require('@discordjs/collection')
const { EventEmitter } = require('events')
const { KitsuneParser, KitsuneParserError } = require('./Kitsune')

class FoxError extends Error {
  constructor (message) {
    super(message)
    this.name = 'FoxError'
    this.message = message
  }
}

class FoxDispatcher extends EventEmitter {
  /**
   * FoxDispatcher is a command dispatcher
   * @extends EventEmitter
   * @class
   * @constructor
   * @public
   * @since modularium/discord:0.1.15.2
   */
  constructor () {
    super()
    this._commands = new Collection()
    /**
     * KitsuneParser
     *
     * @since modularium/fox:0.2.0
     */
    this.parser = new KitsuneParser()
  }

  /**
   * Add a command to dispatcher
   * @param {FoxCommand} cmd Command object
   * @public
   */
  async add (cmd) {
    if (cmd.args) {
      cmd.args = cmd.args.map(arg => {
        if (arg.required === undefined) {
          arg.required = true
        }
  
        return arg
      })
    }
    const command = new FoxCommand(cmd)
    if (FoxCommand.isOld(cmd)) throw new FoxError(command.base + ' is old-typed command. Please, rename [name, description, usage] -> [base, info, args]\nOr, you could use FoxCommand.rebase()')
    await this._commands.set(command.base, command)
  }

  /**
   * Add a simple command to dispatcher
   * @param {string} commandName Command name
   * @param {string} commandDesciption Command description
   * @param {function} commandExecutor Command executor
   * @public
   */
  async addSimple (commandName, commandDesciption, commandExecutor) {
    if (!(typeof commandExecutor === 'function')) {
      throw new FoxError('Command executor is not a function!')
    }

    await this.add({
      base: commandName,
      info: commandDesciption,
      execute: commandExecutor
    })
  }

  /**
   * Remove a command using it's base
   * @param {string} command Command base
   * @public
   */
  async remove (command) {
    const cmd = await this.find(command)

    await this._commands.delete(cmd)
  }

  /**
   * Find a command using it's base
   * @param {string} command Command base
   * @returns {FoxCommand} Command
   * @public
   */
  async find (command) {
    const cmd = await this._commands.find(cmd => {
      if (cmd.aliases) {
        return cmd.base === command || cmd.aliases.includes(command)
      }

      return cmd.base === command
    })

    return cmd
  }

  /**
   * Find a command using it's base in lower case
   * @param {string} command Command base
   * @returns {FoxCommand} Command
   * @public
   */
  async findLowerCase (command) {
    const cmd = await this._commands.find(cmd => {
      if (cmd.aliases) {
        return cmd.base.toLowerCase() === command.toLowerCase() || cmd.aliases.map(v => v.toLowerCase()).includes(command.toLowerCase())
      }

      return cmd.base.toLowerCase() === command.toLowerCase()
    })

    return cmd
  }

  /**
   * Use a command
   * @param {string} command Command base
   * @param {Array} args Command's arguments
   * @param {Message} msg Message
   * @public
   */
  async use (command, args, msg) {
    const cmd = await this.find(command)

    if (cmd) {
      if (!cmd.off) {
        if (!cmd.args) {
          msg ? await cmd.execute(msg, args) : await cmd.execute(args)
        } else {
          try {
            const parsedArgs = await this.parser.parse(args, cmd.args)
            msg ? await cmd.execute(msg, parsedArgs) : await cmd.execute(parsedArgs)
          } catch (e) {
            if (e instanceof KitsuneParserError) {
              msg ? await cmd.onParserError(msg, args, e.value, e.index) : await cmd.onParserError(args, e.value, e.index)
            } else {
              throw e
            }
          }
        }

        return args
      }

      throw new FoxError({
        code: 'off',
        command,
        msg,
        args
      })
    }

    throw new FoxError({
      code: '404',
      command,
      msg,
      args
    })
  }

  /**
   * Parse & use a command
   * @param {string} commandToParse Command to parse
   * @param {Message} msg Message
   * @public
   */
  async parseuse (commandToParse, msg) {
    const parsed = await this.parse(commandToParse)
    return await this.use(...parsed, msg)
  }

  /**
   * Parse a command
   * @param {string} commandToParse Command to parse
   * @returns {[command, args]} Command base, it's arguments
   * @public
   */
  async parse (commandToParse) {
    const args = commandToParse.split(/ +/)
    const command = args.shift().toLowerCase()
    args.forEach((val, i) => {
      if (Number(val)) args[i] = Number(val)
    })
    return [command, args]
  }

  /**
   * Turn on/off a command, using it's base
   * @param {string} command Command base
   * @param {boolean} [userBool On/Off?
   * @public
   */
  async turn (command, userBool) {
    const cmd = await this.find(command)

    cmd.off = !cmd.off || userBool
  }
}

class FoxCommand {
  constructor ({ base, info, emoji, args, off, execute, parse, aliases, onParserError }) {
    if (!base || !execute) throw new FoxError('No base or execute()')

    this.base = base
    this.info = info
    this.emoji = emoji
    this.args = args
    this.off = off
    this.execute = execute
    this.parse = parse
    this.aliases = aliases
    this.onParserError = onParserError
  }

  static isOld (cmd) {
    if (cmd.name || cmd.description || cmd.usage) return true
    else return false
  }

  /**
   * Rebase old type command to new type
   * @param {{ name:string, description:string, usage:Array<string> }} cmd Command object
   * @returns {{ base:string, info:string, args:Array<string> }} rebasedCmd
   */
  static rebase (cmd) {
    const rebasedCmd = {}

    Object.entries(cmd).forEach(([key, val]) => {
      if (key === 'name') rebasedCmd.base = val
      else if (key === 'description') rebasedCmd.info = val
      else if (key === 'usage') rebasedCmd.args = val
      else rebasedCmd[key] = val
    })

    return rebasedCmd
  }

  getUsage () {
    if (!this.usage) return undefined

    const toRequiredType = name => '<' + name + '>'
    const toNotRequiredType = name => '[' + name + ']'

    const keyNames = this.args.map(({ type, required, count, name: keyName }) => {
      let name = keyName || type

      if (Array.isArray(type)) {
        name = keyName || type.join('|')
      }

      if (count) {
        name += ':' + count
      }

      return required ? toRequiredType(name) : toNotRequiredType(name)
    })

    return keyNames.join(' ')
  }
}

module.exports = {
  FoxDispatcher,
  FoxCommand,
  FoxError
}
