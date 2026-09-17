#!/usr/bin/env node

const readline = require('node:readline/promises')
const { stdin, stdout } = require('node:process')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function parseArgs() {
  const args = process.argv.slice(2)
  const values = {}

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') {
      console.log(`
Versaly CRM - Create first administrator

Usage:
  npm run admin:create
  npm run admin:create -- --email admin@example.com
  npm run admin:create -- --name "Jane Doe" --email admin@example.com

The command securely prompts for the password. It can be run against a fresh
database or an existing user account that should be promoted to ADMIN.
`)
      process.exit(0)
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = args[i + 1]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`)
      values[key] = value
      i += 1
    }
  }

  return values
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function ask(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

async function askHidden(question) {
  if (!stdin.isTTY) {
    // Non-interactive environments should use a secure secret-injection mechanism
    // rather than pretending terminal input can be hidden.
    throw new Error('A TTY is required for password entry. Run this command from an interactive terminal.')
  }

  stdout.write(question)
  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf8')

  return new Promise((resolve, reject) => {
    let value = ''

    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
      stdout.write('\n')
    }

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          cleanup()
          reject(new Error('Cancelled'))
          return
        }
        if (char === '\r' || char === '\n') {
          cleanup()
          resolve(value)
          return
        }
        if (char === '\u007f') {
          value = value.slice(0, -1)
          continue
        }
        value += char
      }
    }

    stdin.on('data', onData)
  })
}

async function main() {
  const args = parseArgs()

  console.log('\nVersaly CRM - First Administrator Setup')
  console.log('---------------------------------------')
  console.log('This command creates an ADMIN account or promotes an existing account.\n')

  const name = args.name || await ask('Admin name: ')
  let email = (args.email || await ask('Admin email: ')).toLowerCase()

  if (!name) throw new Error('Admin name is required.')
  if (!validateEmail(email)) throw new Error('Please enter a valid email address.')

  const password = await askHidden('Admin password (min 12 characters): ')
  if (password.length < 12) throw new Error('The admin password must be at least 12 characters long.')

  const confirmation = await askHidden('Confirm admin password: ')
  if (password !== confirmation) throw new Error('The passwords do not match.')

  const existing = await prisma.user.findUnique({ where: { email } })
  const passwordHash = await bcrypt.hash(password, 12)

  if (existing) {
    const shouldUpdate = (await ask(
      `An account already exists for ${email}. Promote/update it as ADMIN? (y/N): `
    )).toLowerCase()

    if (shouldUpdate !== 'y' && shouldUpdate !== 'yes') {
      console.log('No changes made.')
      return
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: { name, password: passwordHash, role: 'ADMIN', isActive: true },
    })

    await prisma.session.deleteMany({ where: { userId: existing.id } })

    console.log(`\nAdministrator account updated successfully: ${email}`)
    console.log('Existing sessions were invalidated. Sign in again with the new password.')
    return
  }

  await prisma.user.create({
    data: { name, email, password: passwordHash, role: 'ADMIN', isActive: true },
  })

  console.log(`\nAdministrator account created successfully: ${email}`)
  console.log('You can now start the CRM and sign in through the normal Login page.')
}

main()
  .catch((error) => {
    console.error(`\nAdmin setup failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
