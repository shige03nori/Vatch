import '@testing-library/jest-dom'
import dotenv from 'dotenv'

// Load environment variables from .env.local or .env files
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })
