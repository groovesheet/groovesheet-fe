/**
 * The yuan payment note names only the wallets Stripe reports active. On
 * 2026-10-04 WeChat Pay was approved while Alipay was still pending, and the
 * old copy said "Alipay or WeChat Pay" for any non-empty list.
 */
import { walletNames } from '@/lib/useBillingCatalog';
import en from '@/messages/en.json';
import zhCN from '@/messages/zh-CN.json';

type Messages = typeof en;

function translator(messages: Messages) {
  return (key: string) =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages) as string;
}

describe('walletNames', () => {
  it('names only WeChat Pay while Alipay is pending', () => {
    expect(walletNames(['wechat_pay'], translator(en))).toBe('WeChat Pay');
    expect(walletNames(['wechat_pay'], translator(zhCN as Messages), 'or')).toBe('微信支付');
  });

  it('lists Alipay first however the backend orders them', () => {
    expect(walletNames(['wechat_pay', 'alipay'], translator(en))).toBe('Alipay, WeChat Pay');
    expect(walletNames(['wechat_pay', 'alipay'], translator(en), 'or')).toBe('Alipay or WeChat Pay');
    expect(walletNames(['wechat_pay', 'alipay'], translator(zhCN as Messages))).toBe('支付宝、微信支付');
  });

  it('is empty when no wallet is active or the name is unknown', () => {
    expect(walletNames([], translator(en))).toBe('');
    expect(walletNames(['grabpay'], translator(en))).toBe('');
  });
});
