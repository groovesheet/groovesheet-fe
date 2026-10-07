import { suggestEmail, suggestEmailDomain } from '@/lib/emailTypo';

describe('suggestEmailDomain', () => {
  it.each([
    ['kakacomc.com', 'kakao.com'], // the 2026-10-07 visitor
    ['gmial.com', 'gmail.com'],
    ['gmai.com', 'gmail.com'],
    ['gmail.con', 'gmail.com'],
    ['gmail.co', 'gmail.com'],
    ['gmail', 'gmail.com'],
    ['gmailcom.com', 'gmail.com'],
    ['gmail.com.com', 'gmail.com'],
    ['qq.con', 'qq.com'],
    ['qq.cm', 'qq.com'],
    ['163.cmo', '163.com'],
    ['hotmial.com', 'hotmail.com'],
    ['hotmail.cm', 'hotmail.com'],
    ['outlok.com', 'outlook.com'],
    ['yahooo.com', 'yahoo.com'],
    ['icloud.co', 'icloud.com'],
    ['iclod.com', 'icloud.com'],
    ['navr.com', 'naver.com'],
    ['naver.co', 'naver.com'],
    ['kakao.co', 'kakao.com'],
    ['kako.com', 'kakao.com'],
    ['foxmial.com', 'foxmail.com'],
    ['hanmial.net', 'hanmail.net'],
    ['GMAIL.COM ', null],
  ])('%s -> %s', (typed, expected) => {
    expect(suggestEmailDomain(typed)).toBe(expected);
  });

  it.each([
    'gmail.com', 'qq.com', '163.com', 'kakao.com', 'naver.com', 'hotmail.co.uk', 'yahoo.co.jp',
    // real, different domains that sit near known ones
    'mi.com', 'qqq.com', 'kelin.studio', 'groovesheet.net', 'mail.groovesheet.net', 'gmx.at',
    'univ.edu', 'company.co', 'nus.edu.sg', 'live.cn', 'hotmail.it', 'outlook.de',
  ])('leaves %s alone', (domain) => {
    expect(suggestEmailDomain(domain)).toBeNull();
  });
});

describe('suggestEmail', () => {
  it('keeps the local part and swaps the domain', () => {
    expect(suggestEmail('gak.min@kakacomc.com')).toBe('gak.min@kakao.com');
  });
  it('returns null for good or malformed input', () => {
    expect(suggestEmail('someone@gmail.com')).toBeNull();
    expect(suggestEmail('no-at-sign')).toBeNull();
    expect(suggestEmail('@gmail.con')).toBeNull();
  });
});
