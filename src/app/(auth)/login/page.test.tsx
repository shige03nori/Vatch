import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from './page'

const mockSignIn = jest.fn()
const mockPush = jest.fn()

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

beforeEach(() => {
  mockSignIn.mockReset()
  mockPush.mockReset()
})

test('VATCHロゴとログインフォームが表示される', () => {
  render(<LoginPage />)
  expect(screen.getByText('VATCH')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('yamada@vicent.co.jp')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /ログイン/ })).toBeInTheDocument()
  expect(screen.getByText('パスワードをお忘れですか？')).toBeInTheDocument()
})

test('メール未入力でサブミットするとエラーが表示される', async () => {
  render(<LoginPage />)
  fireEvent.click(screen.getByRole('button', { name: /ログイン/ }))
  expect(await screen.findByText('メールアドレスを入力してください')).toBeInTheDocument()
  expect(mockSignIn).not.toHaveBeenCalled()
})

test('パスワード未入力でサブミットするとエラーが表示される', async () => {
  render(<LoginPage />)
  fireEvent.change(screen.getByPlaceholderText('yamada@vicent.co.jp'), {
    target: { value: 'test@example.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: /ログイン/ }))
  expect(await screen.findByText('パスワードを入力してください')).toBeInTheDocument()
  expect(mockSignIn).not.toHaveBeenCalled()
})

test('ログイン成功時に /dashboard へ遷移する', async () => {
  mockSignIn.mockResolvedValueOnce(undefined)
  render(<LoginPage />)
  fireEvent.change(screen.getByPlaceholderText('yamada@vicent.co.jp'), {
    target: { value: 'yamada@vicent.co.jp' },
  })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: 'password123' },
  })
  fireEvent.click(screen.getByRole('button', { name: /ログイン/ }))
  await waitFor(() => {
    expect(mockSignIn).toHaveBeenCalledWith('credentials', {
      email: 'yamada@vicent.co.jp',
      password: 'password123',
      redirect: false,
    })
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })
})

test('認証失敗時にエラーメッセージが表示される', async () => {
  mockSignIn.mockRejectedValueOnce(new Error('CredentialsSignin'))
  render(<LoginPage />)
  fireEvent.change(screen.getByPlaceholderText('yamada@vicent.co.jp'), {
    target: { value: 'wrong@example.com' },
  })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: 'wrongpass' },
  })
  fireEvent.click(screen.getByRole('button', { name: /ログイン/ }))
  expect(
    await screen.findByText('メールアドレスまたはパスワードが正しくありません')
  ).toBeInTheDocument()
})
