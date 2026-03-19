'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/Topbar';

type EmailSource = {
  id: string;
  label: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  isActive: boolean;
};

const emptyForm = { label: '', imapHost: '', imapPort: 993, imapUser: '', imapPass: '' };

export default function EmailSourcesPage() {
  const [sources, setSources] = useState<EmailSource[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/email-sources');
    if (!res.ok) return;
    const json = await res.json();
    if (json.success) setSources(json.data);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/email-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, imapPort: Number(form.imapPort) }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        setError(errJson?.errors?.[0]?.message ?? '追加に失敗しました');
        return;
      }
      setForm(emptyForm);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    const res = await fetch(`/api/email-sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (!res.ok) { alert('更新に失敗しました'); return; }
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('削除しますか？')) return;
    const res = await fetch(`/api/email-sources/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('削除に失敗しました'); return; }
    await load();
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-vatch-bg">
      <Topbar title="メール取込設定" />
      <main className="flex-1 p-6 flex flex-col gap-6">
        {/* 登録済み一覧 */}
        <div className="bg-vatch-surface border border-vatch-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-vatch-border">
            <h2 className="text-sm font-semibold text-vatch-text">取込対象メールアドレス</h2>
          </div>
          {sources.length === 0 ? (
            <p className="px-4 py-8 text-center text-vatch-muted text-sm">登録済みの取込設定がありません</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-vatch-border bg-vatch-bg/40">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-vatch-muted">ラベル</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-vatch-muted">IMAPホスト</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-vatch-muted">ユーザー</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-vatch-muted">状態</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((src) => (
                  <tr key={src.id} className="border-b border-vatch-border hover:bg-vatch-surface/60">
                    <td className="px-4 py-3 text-[13px] text-vatch-text">{src.label}</td>
                    <td className="px-4 py-3 text-[13px] text-vatch-text-dim">{src.imapHost}:{src.imapPort}</td>
                    <td className="px-4 py-3 text-[13px] text-vatch-text-dim">{src.imapUser}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(src.id, src.isActive)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                          src.isActive
                            ? 'bg-vatch-green/10 text-vatch-green border-vatch-green/30 hover:bg-vatch-green/20'
                            : 'bg-vatch-muted/10 text-vatch-muted border-vatch-muted/30 hover:bg-vatch-muted/20'
                        }`}
                      >
                        {src.isActive ? '有効' : '無効'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(src.id)}
                        className="px-2 py-1 rounded text-[12px] text-vatch-red border border-vatch-red/30 hover:bg-vatch-red/10 transition-colors"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 追加フォーム */}
        <div className="bg-vatch-surface border border-vatch-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-vatch-text mb-4">取込設定を追加</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
            {error && <p className="col-span-2 text-[13px] text-vatch-red">{error}</p>}
            {[
              { label: 'ラベル', key: 'label', type: 'text', placeholder: 'BP取込用' },
              { label: 'IMAPホスト', key: 'imapHost', type: 'text', placeholder: 'imap.gmail.com' },
              { label: 'IMAPポート', key: 'imapPort', type: 'number', placeholder: '993' },
              { label: 'ユーザー名（メールアドレス）', key: 'imapUser', type: 'email', placeholder: 'you@example.com' },
              { label: 'パスワード', key: 'imapPass', type: 'password', placeholder: '••••••••' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className={key === 'imapPass' ? 'col-span-2' : ''}>
                <label className="block text-[12px] text-vatch-muted mb-1">{label}</label>
                <input
                  type={type}
                  value={String(form[key as keyof typeof form])}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-vatch-bg border border-vatch-border text-[13px] text-vatch-text placeholder:text-vatch-muted focus:outline-none focus:border-vatch-cyan"
                />
              </div>
            ))}
            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-vatch-cyan text-vatch-bg font-semibold text-sm hover:bg-vatch-cyan/90 disabled:opacity-50 transition-colors"
              >
                {saving ? '追加中...' : '追加'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
