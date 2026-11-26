/** Locale for the webclaw-live sidebar tab. */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    webclawLive: keyof typeof zh
  }
}

export const zh = {
  title: '执行画面',
  waiting: '等待执行…',
  offline: '预览未就绪',
  noImage: '暂无画面',
  placeholder: '等待画面…',
  live: '实时',
  scrubHint: '拖动查看过程',
  guideTitle: 'webclaw 执行画面',
  guideDesc: '无头运行时在此回看步骤与实时画面',
  phaseIdle: '空闲',
  phaseRunning: '执行中',
  phaseNeedHuman: '需要人工',
  phaseCancelling: '取消中',
  phaseCancelled: '已取消',
  phaseDone: '已结束',
}

export const en = {
  title: 'Live run',
  waiting: 'Waiting…',
  offline: 'Preview offline',
  noImage: 'No frame yet',
  placeholder: 'Waiting for frame…',
  live: 'Live',
  scrubHint: 'Drag to review',
  guideTitle: 'webclaw live',
  guideDesc: 'Scrub step frames or stay on live',
  phaseIdle: 'Idle',
  phaseRunning: 'Running',
  phaseNeedHuman: 'Needs human',
  phaseCancelling: 'Cancelling',
  phaseCancelled: 'Cancelled',
  phaseDone: 'Done',
} satisfies Record<keyof typeof zh, string>

export const LIVE_NS = 'webclawLive'
