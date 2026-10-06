/* ============================================================
   Auth Bindings
   ============================================================ */
import { getClient } from './supabase.js';
import { setState, resetState } from './state.js';
import { toast } from './ui/toast.js';
import { t } from './i18n.js';
import { setLoading } from './ui/events.js';
import { showAuth, hideAuth } from './app.js';

export function bindAuthEvents() {
  const form = document.getElementById('login-form');
  form?.addEventListener('submit', handleLogin);

  const toggle = document.getElementById('toggle-password');
  toggle?.addEventListener('click', () => {
    const input = document.getElementById('login-password');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  const logout = document.getElementById('logout-btn');
  logout?.addEventListener('click', handleLogout);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const btn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  if (!email || !password) return;

  setLoading(btn, true, 'جاري التحقق...');
  errorEl?.classList.add('hidden');

  try {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('No session created');
    toast('تم تسجيل الدخول بنجاح.', 'success');
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = friendlyAuthError(err);
      errorEl.classList.remove('hidden');
    }
  } finally {
    setLoading(btn, false);
  }
}

async function handleLogout() {
  try {
    const { error } = await getClient().auth.signOut({ scope: 'local' });
    if (error) {
      console.error('Logout error:', error);
      toast('تعذر تسجيل الخروج. حاول مرة أخرى.', 'error');
      return;
    }
    // State reset and UI update handled by auth state listener
  } catch (err) {
    console.error('Logout failed:', err);
    toast('تعذر تسجيل الخروج. حاول مرة أخرى.', 'error');
  }
}

function friendlyAuthError(error) {
  const msg = String(error?.message || '');
  if (/invalid login credentials/i.test(msg)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (/email not confirmed/i.test(msg)) return 'يجب تأكيد البريد الإلكتروني قبل الدخول.';
  if (/too many requests/i.test(msg)) return 'محاولات كثيرة. انتظر قليلاً.';
  return 'تعذر تسجيل الدخول. تحقق من البيانات.';
}
