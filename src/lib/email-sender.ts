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

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  })

  return transporter
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const transporter = getTransporter()

  const attachments = []
  if (params.attachmentPath && fs.existsSync(params.attachmentPath)) {
    attachments.push({
      filename: path.basename(params.attachmentPath),
      path: params.attachmentPath
    })
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    text: params.body,
    attachments
  })
}
