/**
 * Titles and descriptions for the translated static routes, per locale.
 *
 * Until September 2026 every static route had one English title in
 * lib/seo/routeMeta.ts, served at every locale, so /zh-CN was a Chinese page
 * with an English <title> and description. The title is the line Google shows
 * and weighs most, and it was the one line not translated.
 *
 * A route belongs here or in ENGLISH_ONLY_PATHS, never neither:
 * tests/seo/routeMetaI18n.test.ts fails a translated route with no Chinese
 * title. English stays in routeMeta.ts, which is the fallback.
 *
 * Search terms, not literal translations. Chinese readers search 扒谱 ("take
 * a song down by ear") for transcription and 人声分离 for vocal separation,
 * so those lead where they fit. Keep titles short: CJK characters render about
 * twice as wide as Latin ones in the result snippet.
 */
import type { Locale } from '@/lib/locales';
import type { RouteMeta } from './routeMeta';

export const LOCALIZED_ROUTE_META: Partial<Record<Locale, Record<string, RouteMeta>>> = {
  'zh-CN': {
    '/': {
      title: 'AI 扒谱：音频转乐谱、分轨与 MIDI',
      description:
        '把任何歌曲转成乐谱。AI 为鼓、钢琴和贝斯扒谱，并支持音轨分离和音频转 MIDI，可导出 PDF、MusicXML 与 MIDI。',
    },
    '/stem-splitter': {
      title: '免费 AI 人声分离与音轨分离',
      description: '用 AI 把任何歌曲分离成独立的人声、鼓、贝斯和乐器分轨。每首歌都可免费预览，只为处理的分钟数付费。',
    },
    '/midi-converter': {
      title: '免费音频转 MIDI：支持 MP3 与 WAV',
      description: '用 AI 把 MP3、WAV 等任何音频转换成 MIDI，得到可在 DAW 中编辑的音符。免费预览，只为处理的分钟数付费。',
    },
    '/pricing': {
      title: '价格：只为用到的分钟数付费',
      description: '无需订阅。每首歌都可免费预览，再按转谱或分离的音频分钟数付费。查看完整价目与各方案包含的内容。',
    },
    '/help': {
      title: '帮助与支持',
      description: '关于支持的文件格式、转谱准确度、导出、计费与退款的解答，以及直接联系 GrooveSheet 团队的方式。',
    },
  },
  'zh-TW': {
    '/': {
      title: 'AI 扒譜：音訊轉樂譜、分軌與 MIDI',
      description:
        '把任何歌曲轉成樂譜。AI 為鼓、鋼琴和貝斯扒譜，並支援音軌分離和音訊轉 MIDI，可匯出 PDF、MusicXML 與 MIDI。',
    },
    '/stem-splitter': {
      title: '免費 AI 人聲分離與音軌分離',
      description: '用 AI 把任何歌曲分離成獨立的人聲、鼓、貝斯和樂器分軌。每首歌都可免費預覽，只為處理的分鐘數付費。',
    },
    '/midi-converter': {
      title: '免費音訊轉 MIDI：支援 MP3 與 WAV',
      description: '用 AI 把 MP3、WAV 等任何音訊轉換成 MIDI，得到可在 DAW 中編輯的音符。免費預覽，只為處理的分鐘數付費。',
    },
    '/pricing': {
      title: '價格：只為用到的分鐘數付費',
      description: '無需訂閱。每首歌都可免費預覽，再依轉譜或分離的音訊分鐘數付費。查看完整價目與各方案包含的內容。',
    },
    '/help': {
      title: '幫助與支援',
      description: '關於支援的檔案格式、轉譜準確度、匯出、計費與退款的解答，以及直接聯絡 GrooveSheet 團隊的方式。',
    },
  },
};
