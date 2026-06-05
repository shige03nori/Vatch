export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initEmailScheduler } = await import('./src/jobs/email-scheduler')
    initEmailScheduler()
  }
}
