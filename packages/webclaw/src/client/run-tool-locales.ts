/** Locale for the webclaw_run in-chat toolview. */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    webclawRunTool: keyof typeof zh
  }
}

export const zh = {
  pending: '正在执行菜谱…',
  offline: '本机日志服务未就绪',
  empty: '等待步骤日志…',
  placeholder: '等待画面…',
  done: '执行结束',
  failed: '执行失败',
  cancelled: '已取消',
  needHuman: '需要人工确认',
}

export const en = {
  pending: 'Running recipe…',
  offline: 'Local log service offline',
  empty: 'Waiting for step logs…',
  placeholder: 'Waiting for frame…',
  done: 'Finished',
  failed: 'Failed',
  cancelled: 'Cancelled',
  needHuman: 'Needs human input',
} satisfies Record<keyof typeof zh, string>

export const RUN_TOOL_NS = 'webclawRunTool'
