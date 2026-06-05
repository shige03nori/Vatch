import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'

interface SendEmailParams {
  to: string
  subject: string
  body: string
  attachmentPath?: string
}

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP configuration is incomplete. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD')
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: process.env.SMTP_SECURE === 'true',
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    auth: {
      user,
      pass
    }
  })

  return transporter
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  // Validate inputs
  if (!params.to || !params.subject || !params.body) {
    throw new Error('Email to, subject, and body are required')
  }

  if (!validateEmail(params.to)) {
    throw new Error(`Invalid email address: ${params.to}`)
  }

  // Validate attachment if provided
  const attachments = []
  if (params.attachmentPath) {
    if (!fs.existsSync(params.attachmentPath)) {
      throw new Error(`Attachment file not found: ${params.attachmentPath}`)
    }

    try {
      fs.accessSync(params.attachmentPath, fs.constants.R_OK)
      attachments.push({
        filename: path.basename(params.attachmentPath),
        path: params.attachmentPath
      })
    } catch (error) {
      throw new Error(`Cannot read attachment file: ${params.attachmentPath}`)
    }
  }

  try {
    const transporter = getTransporter()
    const fromEmail = process.env.SMTP_FROM_EMAIL

    if (!fromEmail) {
      throw new Error('SMTP_FROM_EMAIL is not configured')
    }

    await transporter.sendMail({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      text: params.body,
      attachments
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to send email:', errorMessage)
    throw new Error(`Email send failed: ${errorMessage}`)
  }
}
