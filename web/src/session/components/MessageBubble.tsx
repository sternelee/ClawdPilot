/**
 * MessageBubble Component
 *
 * Displays a single message in the chat
 */

import { For, Show, createSignal } from 'solid-js'
import {
  CheckCircle2,
  ChevronRight,
  Loader,
  Paperclip,
  Wrench,
  XCircle,
} from 'lucide-solid'
import { cn } from '~/lib/utils'
import type { ChatMessage } from '../types'

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  toolStatus?: Record<
    string,
    {
      toolName: string
      status: 'started' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
      input?: unknown
      output?: string
    }
  >
}

export function MessageBubble(props: MessageBubbleProps) {
  const isUser = () => props.message.role === 'user'
  const [expandedToolIds, setExpandedToolIds] = createSignal<
    Record<string, boolean>
  >({})

  const getToolCallState = (
    toolCall: NonNullable<ChatMessage['toolCalls']>[number],
  ) => props.toolStatus?.[toolCall.id] ?? toolCall

  const toggleToolCall = (toolId: string) => {
    setExpandedToolIds((current) => ({
      ...current,
      [toolId]: !current[toolId],
    }))
  }

  const isToolExpanded = (toolId: string) => Boolean(expandedToolIds()[toolId])

  const renderToolStatus = (
    status: NonNullable<ChatMessage['toolCalls']>[number]['status'],
  ) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 class="h-4 w-4 text-success" />
      case 'failed':
      case 'cancelled':
        return <XCircle class="h-4 w-4 text-error" />
      case 'started':
      case 'in_progress':
        return <Loader class="h-4 w-4 animate-spin text-primary" />
      default:
        return <Wrench class="h-4 w-4 text-base-content/45" />
    }
  }

  return (
    <div class={cn('flex py-3', isUser() ? 'justify-end' : 'justify-start')}>
      <div
        class={cn(
          'min-w-0',
          isUser()
            ? 'max-w-[min(42rem,85%)]'
            : 'w-full max-w-3xl space-y-3 text-base-content',
        )}
      >
        <Show
          when={!isUser()}
          fallback={
            <div class="rounded-[1.5rem] bg-base-200 px-4 py-3 text-[15px] leading-6 text-base-content shadow-sm ring-1 ring-black/5">
              <div class="whitespace-pre-wrap break-words">
                {props.message.content}
                <Show when={props.isStreaming}>
                  <span class="ml-2 inline-flex items-center gap-2 text-primary/80">
                    <Loader class="h-3.5 w-3.5 animate-spin" />
                    <span class="text-xs font-medium">Typing</span>
                  </span>
                </Show>
              </div>
            </div>
          }
        >
          <div class="whitespace-pre-wrap break-words text-[15px] leading-7 text-base-content">
            {props.message.content}
          </div>
          <Show when={props.isStreaming}>
            <div class="flex items-center gap-2 text-sm text-primary/80">
              <Loader class="h-3.5 w-3.5 animate-spin" />
              <span>Typing</span>
            </div>
          </Show>

          <Show
            when={props.message.toolCalls && props.message.toolCalls.length > 0}
          >
            <div class="space-y-2">
              <For each={props.message.toolCalls}>
                {(toolCall) => {
                  const currentToolCall = () => getToolCallState(toolCall)
                  const expanded = () => isToolExpanded(toolCall.id)

                  return (
                    <div class="overflow-hidden rounded-2xl border border-base-300/80 bg-base-100 shadow-sm">
                      <button
                        type="button"
                        class="flex w-full items-center gap-3 px-4 py-3 text-left"
                        onClick={() => toggleToolCall(toolCall.id)}
                      >
                        <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70">
                          <Wrench class="h-4 w-4" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="truncate text-sm font-semibold text-base-content">
                            {currentToolCall().toolName}
                          </div>
                          <Show when={currentToolCall().output}>
                            <div class="truncate text-xs text-base-content/50">
                              {String(currentToolCall().output)}
                            </div>
                          </Show>
                        </div>
                        <div class="flex items-center gap-2 text-base-content/45">
                          {renderToolStatus(currentToolCall().status)}
                          <ChevronRight
                            class={cn(
                              'h-4 w-4 transition-transform',
                              expanded() && 'rotate-90',
                            )}
                          />
                        </div>
                      </button>

                      <Show
                        when={
                          expanded() &&
                          (currentToolCall().input || currentToolCall().output)
                        }
                      >
                        <div class="border-t border-base-300/80 px-4 py-3 text-xs text-base-content/75">
                          <Show when={currentToolCall().input}>
                            <div class="mb-3">
                              <div class="mb-1 font-medium text-base-content/55">
                                Input
                              </div>
                              <pre class="overflow-x-auto whitespace-pre-wrap rounded-xl bg-base-200 px-3 py-2">
                                {JSON.stringify(currentToolCall().input, null, 2)}
                              </pre>
                            </div>
                          </Show>
                          <Show when={currentToolCall().output}>
                            <div>
                              <div class="mb-1 font-medium text-base-content/55">
                                Output
                              </div>
                              <pre class="overflow-x-auto whitespace-pre-wrap rounded-xl bg-base-200 px-3 py-2">
                                {String(currentToolCall().output)}
                              </pre>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>

          {/* Attachments */}
          <Show
            when={
              props.message.attachments && props.message.attachments.length > 0
            }
          >
            <div class="flex flex-wrap gap-2">
              <For each={props.message.attachments}>
                {(attachment) => (
                  <div class="inline-flex items-center gap-2 rounded-full bg-base-200 px-3 py-1.5 text-xs text-base-content/80">
                    <Paperclip class="h-3.5 w-3.5" />
                    <span>{attachment.filename}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  )
}
