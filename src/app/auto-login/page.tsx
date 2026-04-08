import { signIn } from '@/lib/auth'

export default async function AutoLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  await signIn('credentials', {
    email: 's.nita@vicent.co.jp',
    password: 'demo',
    redirectTo: callbackUrl ?? '/dashboard',
  })
}
