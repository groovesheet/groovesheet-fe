'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { FORMAT_PARAM_BY_LABEL, LENGTH_PARAM_BY_LABEL } from '@/lib/exploreConstants';

export type FacetGroup = 'instrument' | 'format' | 'length';

/**
 * Filter values in the page's language.
 *
 * The sidebar and the results page keep their filters as English labels
 * ('Drums', 'Sheet Music', '2 to 5 min'), because those labels map one to one
 * onto the URL's `instrument=`, `format=` and `length=` values. They are
 * identifiers. This turns one into what the visitor reads: 鼓, 乐谱, 2 至 5 分钟.
 * An instrument the messages do not know keeps the label it came with.
 */
export function useFacetLabel(): (group: FacetGroup, label: string) => string {
  const tSong = useTranslations('song');
  const tExplore = useTranslations('explore.sidebar');
  return useCallback(
    (group: FacetGroup, label: string) => {
      if (group === 'instrument') {
        const key = `instruments.${label.toLowerCase()}.name`;
        return tSong.has(key) ? tSong(key) : label;
      }
      const param = group === 'format' ? FORMAT_PARAM_BY_LABEL[label] : LENGTH_PARAM_BY_LABEL[label];
      const key = `${group === 'format' ? 'formats' : 'lengths'}.${param}`;
      return param && tExplore.has(key) ? tExplore(key) : label;
    },
    [tSong, tExplore]
  );
}
