/**
 * Chinese names for the drums and drum families on /launchpad, in the words
 * Chinese-speaking drummers use (底鼓, 军鼓, 踩镲, 叮叮镲 ...). The page shows
 * these by default, with a switch back to English.
 */
import { voiceById } from '../midikeys/drumKit';
import { FAMILIES } from './layout';

export const DRUM_ZH = {
  kick: '底鼓',
  kick808: '808底鼓',
  snare: '军鼓',
  snare2: '亮军鼓',
  rim: '鼓边',
  clap: '拍手',
  hatClosed: '闭镲',
  hatPedal: '脚踩镲',
  hatOpen: '开镲',
  tom1: '落地通鼓',
  tom2: '落地通鼓2',
  tom3: '低音通鼓',
  tom4: '中音通鼓',
  tom5: '中高音通鼓',
  tom6: '高音通鼓',
  crash: '吊镲',
  crash2: '吊镲2',
  ride: '叮叮镲',
  ride2: '叮叮镲2',
  rideBell: '叮叮镲帽',
  splash: '水镲',
  china: '中国镲',
  tambourine: '铃鼓',
  cowbell: '牛铃',
  vibraslap: '颤音器',
  bongoHigh: '高音邦戈鼓',
  bongoLow: '低音邦戈鼓',
  congaMute: '闷音康加鼓',
  congaOpen: '开放康加鼓',
  congaLow: '低音康加鼓',
  timbaleHigh: '高音天巴鼓',
  timbaleLow: '低音天巴鼓',
  agogoHigh: '高音阿哥哥铃',
  agogoLow: '低音阿哥哥铃',
  cabasa: '卡巴萨',
  shaker: '沙锤',
  eggShaker: '蛋沙锤',
  whistleShort: '短哨',
  whistleLong: '长哨',
  guiroShort: '短刮瓜',
  guiroLong: '长刮瓜',
  clave: '响棒',
  blockHigh: '高音木鱼',
  blockLow: '低音木鱼',
  cuicaMute: '闷音奎卡鼓',
  cuicaOpen: '开放奎卡鼓',
  triangleMute: '闷音三角铁',
  triangleOpen: '开放三角铁',
  jingle: '串铃',
};

export const FAMILY_ZH = {
  kick: '底鼓',
  snare: '军鼓与拍手',
  hat: '踩镲',
  tom: '通鼓',
  cymbal: '镲片',
  hand: '手鼓',
  bell: '铃与木鱼',
  shaker: '沙锤与音效',
};

export const LANGS = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
];

/** A drum's name in the page's language. */
export function drumName(voiceId, lang) {
  if (!voiceId) return '—';
  if (lang === 'zh' && DRUM_ZH[voiceId]) return DRUM_ZH[voiceId];
  return voiceById(voiceId)?.label || '—';
}

/** A drum family's name in the page's language. */
export const familyName = (family, lang) => (lang === 'zh' && FAMILY_ZH[family]) || FAMILIES[family]?.label || '';
