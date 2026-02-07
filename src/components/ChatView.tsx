/**
 * ChatView Component
 *
 * Main chat interface for AI agent interactions with DaisyUI styling.
 * Displays messages, handles user input, shows permission requests, and supports slash commands.
 */

import { For, Show, createEffect, createSignal, onMount } from 'solid-js'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { chatStore } from '../stores/chatStore'
import type { AgentType } from '../stores/sessionStore'
import { notificationStore } from '../stores/notificationStore'
import type { ChatMessage, PermissionRequest } from '../stores/chatStore'

// ============================================================================
// Types
// ============================================================================

interface ChatViewProps {
  sessionId: string
  onSendMessage?: (message: string) => void
  onPermissionResponse?: (permissionId: string, response: 'approved' | 'denied' | 'approved_for_session') => void
  onSpawnRemoteSession?: (agentType: AgentType, projectPath: string, args: string[]) => void
  agentType?: AgentType
}

// ============================================================================
// Icons
// ============================================================================

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
  </svg>
)

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM8 8a1 1 0 112 0 1 1 0 0 0-2 0zm4 0a1 1 0 112 0 1 1 0 0 0-2 0zm-4 4a1 1 0 112 0 1 1 0 0 0-2 0zm4 0a1 1 0 112 0 1 1 0 0 0-2 0z" clip-rule="evenodd" />
  </svg>
)

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
  </svg>
)

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
  </svg>
)

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
  </svg>
)

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
  </svg>
)

const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

// ============================================================================
// Helper Components
// ============================================================================

function MessageBubble(props: { message: ChatMessage }) {
  const isUser = () => props.message.role === 'user'
  const isSystem = () => props.message.role === 'system'

  return (
    <div class={`chat ${isUser() ? 'chat-end' : 'chat-start'}`}>
      <div class="chat-header">
        <Show when={isUser()}>
          <div class="chat-image avatar">
            <div class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center">
              <UserIcon />
            </div>
          </div>
        </Show>
        <Show when={!isUser() && !isSystem()}>
          <div class="chat-image avatar">
            <div class="w-8 h-8 rounded-full bg-secondary text-secondary-content flex items-center justify-center">
              <BotIcon />
            </div>
          </div>
        </Show>
        <Show when={isSystem()}>
          <div class="chat-image avatar">
            <div class="w-8 h-8 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </Show>
        <time class="text-xs opacity-50">
          {new Date(props.message.timestamp || Date.now()).toLocaleTimeString()}
        </time>
      </div>
      <div class={`chat-bubble ${
        isUser()
          ? 'chat-bubble-primary'
          : isSystem()
            ? 'chat-bubble-neutral'
            : 'chat-bubble-secondary'
      }`}>
        <div class="whitespace-pre-wrap break-words text-sm">
          {props.message.content}
        </div>
        <Show when={props.message.toolCalls && props.message.toolCalls.length > 0}>
          <div class="mt-2 flex flex-wrap gap-1">
            <For each={props.message.toolCalls}>
              {(tool) => (
                <div class="badge badge-ghost badge-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-3.293 2.119-.2.892-.275 1.865-.175 2.772-.813.112-1.632.313-2.228.66-.545.32-1.05.69-1.483 1.103-.35.33-.643.72-.866 1.138-.186.352-.34.732-.453 1.128-.085.307-.164.62-.228.936-.026.16.078.314.238.398.16.084.35.094.518.026.17-.068.294-.222.32-.397a4.796 4.796 0 01.592-2.205 5.459 5.459 0 01.967-2.02c.873-1.433 2.504-2.553 4.227-2.96 1.723-.406 3.574.244 4.89 1.67.685.75 1.143 1.683 1.356 2.68.15.715.18 1.458.2 2.195.063.737-.138 1.44-.428 2.107-.876.24-.154.456-.35.625-.585.17-.235.248-.52.275-.813.027-.294-.136-.55-.382-.724-.653a3.97 3.97 0 00-.849-.981 3.977 3.977 0 00-1.33-.787c-.96-.388-2.06-.2-2.874.52a3.852 3.852 0 00-.888 1.014c-.268.43-.47.907-.59 1.403-.12.496-.16 1.01-.113 1.525.047.515.175.998.382 1.443a4.73 4.73 0 001.123 1.525c.507.432 1.1.72 1.738.828.637.108 1.295.133 1.943.072a4.21 4.21 0 001.72-.615c.512-.31.963-.72 1.32-1.218.357-.497.617-1.062.767-1.66.15-.597.19-1.24.133-1.87-.057-.63-.29-1.224-.646-1.753-.356-.53-.822-.963-1.38-1.257a3.67 3.67 0 00-1.808-.373c-.632.056-1.24.26-1.758.605a3.588 3.588 0 00-1.12 1.44c-.268.576-.42 1.22-.44 1.884-.02.665.12 1.313.413 1.907.292.594.72 1.092 1.258 1.432.537.34 1.152.514 1.77.48a3.73 3.73 0 001.722-.438 3.646 3.646 0 001.32-1.218c.356-.535.593-1.15.696-1.797.103-.647.082-1.316-.064-1.946-.146-.63-.425-1.183-.837-1.618a4.07 4.07 0 00-1.413-.93c-.557-.22-1.175-.304-1.78-.245a3.974 3.974 0 00-1.632.632 4.098 4.098 0 00-1.178 1.363c-.29.543-.462 1.152-.493 1.783-.03.63.093 1.25.366 1.812.273.56.668 1.017 1.15 1.324.482.306 1.04.44 1.61.38.57-.06 1.12-.25 1.59-.553.47-.303.857-.716 1.128-1.218.27-.5.407-1.07.413-1.665a3.876 3.876 0 00-.37-1.77 4.024 4.024 0 00-1.02-1.405c-.448-.366-.98-.59-1.55-.66-.57-.07-1.16-.01-1.69.176a3.723 3.723 0 00-1.352.945c-.38.41-.67.92-.837 1.493-.167.572-.21 1.202-.134 1.8.076.598.317 1.12.753 1.5 1.28.38.525.62 1.148.685 1.81.064.663-.05 1.31-.345 1.848-.822.537-.477.92-1.115 1.105-1.79.184-.675.164-1.397-.09-2.038a3.787 3.787 0 00-1.046-1.518 3.996 3.996 0 00-1.613-.857c-.59-.163-1.225-.147-1.8.046a3.673 3.673 0 00-1.38.758 3.894 3.894 0 00-.88 1.37c-.213.54-.31 1.143-.273 1.748.038.605.204 1.178.48 1.69a3.94 3.94 0 001.13 1.262c.458.333.99.527 1.546.546a3.19 3.19 0 001.572-.385c.48-.26.877-.635 1.15-1.098.272-.463.41-1 .41-1.572a3.638 3.638 0 00-.35-1.56 3.84 3.84 0 00-.97-1.402 4.057 4.057 0 00-1.54-.826c-.56-.152-1.165-.118-1.73.102a3.562 3.562 0 00-1.286.87c-.364.38-.63.85-.77 1.364-.14.514-.18 1.07-.112 1.617.068.548.243 1.04.546 1.46.936.42.39.735.874.913 1.4.178.526.21 1.102.177 1.658-.102.557-.278 1.036-.718 1.387a3.248 3.248 0 01-1.508.746 3.37 3.37 0 01-1.626-.096c-.53-.186-.988-.516-1.337-.966-.35-.45-.578-.997-.652-1.586a3.476 3.476 0 01.3-1.68c.25-.523.617-.963 1.07-1.286a3.39 3.39 0 011.58-.605c.56-.067 1.14.013 1.654.24.514.225.943.587 1.238 1.06.294.472.444 1.02.425 1.586-.02.566-.19 1.09-.516 1.52-.326.43-.767.738-1.282.904a2.933 2.933 0 01-1.622.018c-.52-.147-.96-.45-1.274-.88-.314-.43-.474-.947-.462-1.51.012-.564.193-1.09.527-1.526a2.78 2.78 0 011.52-.71c.537-.088 1.098-.024 1.588.19.49.214.895.557 1.18 1.01.284.452.42.987.373 1.55a2.75 2.75 0 01-.555 1.508c-.376.41-.876.68-1.45.786-.573.106-1.178.045-1.712-.182a2.58 2.58 0 01-1.13-.905c-.296-.41-.44-.907-.413-1.436.027-.53.215-1.02.552-1.406.337-.385.818-.612 1.34-.666.52-.054 1.062.013 1.54.2.477.184.854.503 1.108.922.254.42.36.92.312 1.45-.048.532-.244.99-.576 1.35-.332.36-.79.546-1.296.617-.506.07-1.04-.004-1.522-.22a2.39 2.39 0 01-1.002-.86c-.265-.38-.396-.843-.37-1.34.025-.5.195-.95.5-1.33.306-.38.73-.578 1.22-.633.49-.054 1 .01 1.45.192.45.18.8.484 1.018.883.217.4.32.86.283 1.35-.038.49-.22.925-.526 1.25a2.17 2.17 0 01-1.29.596c-.468.054-.954-.01-1.38-.18a2.19 2.19 0 01-.9-.79c-.23-.36-.34-.79-.31-1.26.027-.47.19-.9.48-1.23a2.06 2.06 0 011.27-.49c.447-.03.91.02 1.31.15.4.13.73.418.94.815.21.396.29.86.24 1.33-.05.47-.2.88-.46 1.18-.26.3-.62.44-1.05.47a2.02 2.02 0 01-1.18-.17 2.05 2.05 0 01-.83-.72c-.21-.31-.31-.7-.28-1.12.027-.42.18-.8.44-1.1.26-.3.6-.42 1.02-.46a1.96 1.96 0 011.12.14c.33.17.58.44.72.77.14.33.19.72.13 1.13-.06.41-.22.76-.46 1.02-.24.26-.57.38-.95.4a1.88 1.88 0 01-1.06-.12 1.9 1.9 0 01-.75-.65c-.19-.27-.27-.6-.23-.95.04-.35.18-.65.4-.88.22-.23.52-.35.87-.37.35-.02.72.03 1.04.15.32.12.55.35.67.63.12.28.16.62.11.98-.05.36-.2.66-.43.88-.23.22-.54.32-.9.33a1.78 1.78 0 01-.99-.08 1.77 1.77 0 01-.66-.57c-.17-.23-.23-.52-.18-.83.05-.31.2-.57.41-.76.21-.19.5-.28.84-.28.34 0 .69.07.98.22.29.15.48.37.58.63.1.26.12.57.07.88-.05.31-.2.57-.43.74-.23.17-.54.23-.9.2a1.66 1.66 0 01-.92-.15c-.26-.12-.44-.33-.53-.59-.09-.26-.1-.56-.01-.86.08-.3.25-.52.48-.66.23-.14.54-.18.88-.13.34.05.66.2.87.42.21.22.3.5.23.8-.07.3-.24.53-.48.65-.24.12-.56.12-.88-.01a1.53 1.53 0 01-.82-.3c-.22-.14-.37-.36-.43-.63-.06-.27-.04-.57.08-.85.12-.28.34-.46.6-.55.26-.09.59-.08.9.04.31.12.53.33.64.58.11.25.1.55.02.84-.08.29-.26.49-.52.58-.26.09-.6.06-.92-.08a1.41 1.41 0 01-.7-.38c-.17-.15-.27-.37-.28-.63a1.13 1.13 0 01.2-.83c.16-.23.42-.38.7-.45.28-.07.61-.04.92.07.31.11.51.31.6.56.09.25.06.54-.07.8-.13.26-.37.42-.66.46-.29.04-.63-.02-.95-.18a1.28 1.28 0 01-.56-.45c-.12-.19-.17-.43-.13-.69.04-.26.22-.46.48-.57.26-.11.6-.1.93.03.33.13.53.35.6.63.07.28.02.59-.13.86-.15.27-.42.42-.72.44-.3.02-.64-.07-.95-.27a1.16 1.16 0 01-.43-.5c-.08-.2-.1-.44-.04-.67.06-.23.25-.4.51-.48.26-.08.61-.04.94.1.33.14.5.38.54.66.04.28-.02.59-.18.85-.16.26-.45.37-.77.37-.32 0-.66-.14-.93-.38a1.05 1.05 0 01-.3-.55c-.03-.22.02-.45.14-.65.12-.2.32-.33.58-.38.26-.05.6-.01.89.13.29.14.46.39.47.67.01.28-.08.58-.24.81-.16.23-.46.3-.78.28-.32-.02-.66-.18-.93-.43-.26-.25-.37-.56-.32-.88.05-.32.2-.58.46-.77.26-.19.6-.25.94-.17.34.08.57.29.7.55.13.26.1.58-.04.87-.14.29-.4.44-.73.42-.33-.02-.68-.19-.95-.46a.96.96 0 01-.28-.8c.04-.28.2-.5.47-.63.27-.13.62-.1.97.05.35.15.54.4.57.68.03.28-.08.58-.27.78-.19.2-.49.28-.82.22-.33-.06-.68-.25-.94-.5-.26-.25-.34-.57-.26-.9.08-.33.27-.57.58-.7.31-.13.7-.07 1.04.18.34.25.46.58.38.92-.08.34-.3.55-.63.59-.33.04-.7-.12-.98-.37-.28-.25-.34-.6-.23-.95.11-.35.38-.58.7-.63.32-.05.73-.02 1.08.08.35.1.53.37.46.7-.07.33-.31.5-.65.52-.34.02-.73-.13-1.01-.35-.28-.22-.34-.54-.23-.87.11-.33.42-.52.76-.53.34-.01.75.1 1.07.33.32.23.37.56.25.9-.12.34-.45.52-.8.5-.35-.02-.76-.2-1.04-.44-.28-.24-.32-.58-.2-.9.12-.32.48-.48.86-.46.38.02.77.2 1.04.45.27.25.3.6.17.94-.13.34-.52.48-.9.44-.38-.04-.79-.25-1.07-.5-.28-.25-.3-.6-.2-.94.1-.34.48-.48.88-.44.4.04.8.25 1.07.5.27.25.29.6.18.94-.11.34-.5.46-.9.42-.4-.04-.81-.26-1.08-.52-.27-.26-.28-.6-.18-.94.1-.34.48-.45.88-.4.4.05.8.27 1.07.53.27.26.28.6.17.94-.11.34-.5.45-.9.4-.4-.05-.81-.27-1.08-.53-.27-.26-.27-.6-.16-.94.11-.34.49-.43.89-.37.4.06.8.28 1.07.54.27.26.26.6.15.94-.11.34-.5.43-.9.37-.4-.06-.81-.28-1.08-.54-.27-.26-.25-.6-.14-.94.11-.34.5-.42.9-.35.4.07.8.29 1.06.55.26.26.24.6.12.94-.12.34-.5.42-.9.35-.4-.07-.81-.3-1.07-.56-.26-.26-.23-.6-.11-.94.12-.34.51-.4.92-.32.4.08.8.31 1.06.57.26.26.22.6.09.94-.13.34-.52.4-.93.32-.4-.08-.8-.31-1.06-.57-.26-.26-.21-.6-.07-.94.14-.34.53-.38.94-.28.4.1.8.32 1.05.58.25.26.2.6.06.94-.14.34-.53.37-.94.28-.4-.09-.81-.33-1.06-.59-.25-.26-.19-.6-.04-.94.15-.34.55-.35.96-.23.4.12.8.34 1.04.6.24.26.17.6.02.94-.15.34-.55.34-.96.21-.4-.13-.81-.36-1.05-.62-.24-.26-.17-.6-.01-.94.16-.34.56-.32.98-.18.4.14.8.37 1.03.63.23.26.14.6-.03.94-.17.34-.57.28-1 .14-.4-.14-.82-.38-1.06-.64-.24-.26-.15-.6.02-.94.17-.34.59-.23 1.02-.07.4.16.8.4 1.01.66.21.26.11.6-.06.94-.17.34-.6.17-1.04.01-.4-.16-.82-.41-1.05-.67-.23-.26-.13-.6.05-.94.18-.34.61-.12 1.05.06.4.18.78.44.99.7.21.26.08.6-.1.94-.18.34-.62.06-1.07-.13-.4-.19-.82-.46-1.04-.72-.22-.26-.11-.6.07-.94.18-.34.63-.01 1.07.2.4.21.76.49.96.75.2.26.05.6-.14.94-.19.34-.64.04-1.1-.21-.4-.25-.81-.52-1.02-.78-.21-.26-.09-.6.12-.94.21-.34.65.08 1.11.35.4.27.73.55.92.8.19.26.02.6-.19.94-.21.34-.66.11-1.13-.3-.4-.2-.8-.5-1-.77-.2-.27-.07-.6.15-.94.22-.34.66.15 1.14.45.4.3.7.6.88.82.18.26-.01.6-.23.94-.22.34-.67.07-1.16-.39-.4-.2-.76-.52-.96-.8-.2-.27-.05-.6.18-.94.23-.34.68.23 1.17.56.4.33.66.63.83.86.17.26-.04.6-.27.94-.23.34-.68.22-1.2-.49-.4-.2-.7-.55-.88-.83-.18-.27-.03-.6.21-.94.24-.34.69.32 1.2.66.4.34.62.69.78.92.16.26-.07.6-.31.94-.24.34-.7.15-1.24-.6-.4-.22-.64-.59-.8-.9-.16-.3-.01-.6.24-.94.25-.34.7.39 1.27.76.4.37.58.76.72.98.14.26-.1.6-.35.94-.25.34-.71.3-1.31-.72-.4-.24-.58-.65-.7-.97-.12-.32.01-.6.27-.94.26-.34.72.48 1.35.87.4.4.53.84.62.99.09.26-.13.6-.39.94-.26.34-.73.27-1.43-.86-.4-.25-.52-.7-.59-1.05-.07-.35.07-.66.33-.98.26-.32.75-.53 1.38-.95.4-.22.46-.7.47-1.02.01-.32-.14-.6-.41-.9-.27-.3-.68-.4-1.04-.38-.36.02-.66.2-.87.5-.21.3-.28.66-.25 1.03.03.37.22.66.48.83.26.17.58.17.92-.02.34-.19.58-.5.7-.87.22-.37.23-.8.03-1.18-.2-.38-.5-.58-.92-.53-.35.05-.63.28-.83.58-.2.3-.25.7-.18 1.08.07.38.28.66.55.84.27.18.6.12.94-.15.34-.27.52-.62.65-1 .13-.37.09-.8-.14-1.17-.23-.37-.43-.56-.92-.49-1.37.07-.45.32-.74.71-.86 1.12-.12.38-.06.81.12 1.2.18.39.48.56.84.5 1.31-.04.45-.25.72-.59.96-.34.24-.73.29-1.19.13-.46-.16-.78-.51-1.01-.96-.23-.45-.27-.97-.11-1.48.16-.51.46-.73.95-1.07.94-.34.01-.71-.13-1.05-.14-.34-.01-.63.23-.83.53-.2.3-.25.73-.2 1.16.05.43.27.76.57.96.3.2.63.18 1.05-.06.42-.24.68-.61.85-.97.17-.36.16-.78.01-1.18-.15-.4-.16-.78-.58-1.01-.99-.23-.41-.24-.89-.05-1.36.19-.47.57-.8 1.04-1.12.95-.32.07-.65-.13-1.01-.2-.36-.07-.63.32-.83.67-.2.35-.18.79.01 1.18.19.39.48.63.77.9.29.27.67.33 1.07.06.4-.27.71-.65.85-.97.14-.32.1-.7-.08-1.1-.18-.4-.1-.72-.51-.92-.94-.2-.43-.2-.92.02-1.35.22-.43.61-.77 1.09-1.18.96-.41.15-.75-.02-1.12-.19-.37-.17-.64.46-.84.82-.2.36-.13.86.13 1.22.26.36.55.77.72 1.18.17.41.09.9-.14 1.31-.23.41-.32.56-.8.59-1.22.03-.42-.17-.81-.49-1.11-.32-.3-.48-.73-.46-1.17.02-.44.17-.83.49-1.12.32-.29.5-.78.67-1.21.98-.43.31-.72.08-1.1-.23-.38-.31-.56-.84-.48-1.33.08-.49.44-.91.91-1.32.99-.41.33-.66.1-1.01-.27-.35-.37-.46-.9-.34-1.38.12-.48.5-.87 1.02-1.45 1.01-.58-.01-.93-.38-1.26-.37-.33-.48-.93-.33-1.41.15-.48.57-.86 1.2-1.72 1.03-.43.52-.74.93-.77 1.44-.03.51-.31.94-.77 1.26-.46.32-.88.12-1.28-.41-.4-.53-.43-1.15.01-1.67.44-.52.88-.68 1.77-1.95 1.04-.67.73-1.08.27-1.45-.55-.37-.82-.28-1.75.35-2.57 1.06-.82.74-.98 1.45-.35 2.01.63.56 1.34.6 2.15-.03 1.61-.63.98-1.06 1.85-1.73 2.06-.67.21-1.27-.33-1.67-.54-.4-.21-.45-.93-.04-1.46.41-.53 1.04-.53 2.15-.12 3.26.41 1.11.97 1.39 2.07.95.55-.44 1.01-.65 1.54-.21.53.44 1.3.58 1.92.14.62-.44 1.27-.6 1.9-.16.63.36 1.53.99 1.69 1.38.16-.55.21-1.28-.16-1.83-.37-.55-.21-.63-.94-.12-1.49.51-.55 1.28-.37 2.04.18.76.55 1.08 1.5 1.28.78.2.55.17 1.5-.06 2.28-.23.78-.74 1.03-1.68.76-2.66-.27-.98-.9-1.29-1.88-1.34-.99-.05-1.64.52-2.15.57-.51 1.09-.52 2.32-.01 3.69.51 1.37 1.52 1.89 2.92 1.77 1.4-.12 2.15-1.1 2.27-2.5.12-1.4-.9-2.35-2.55-2.7.26-.35.36-.48.9-.12 1.45.36.55 1.47.36 2.88-.22 4.31-.58 1.43-1.73 1.8-3.38.37-1.65-.3-3.22-2.27-3.82 1.07-.6 3.18-.15 4.91.81 1.73 1.93 2.54 1.65 5.41.41 7.57-1.24 2.16-3.77 1.88-6.54.28-2.77-1.96-4.4-4.8-4.63-2.84-.23-5.06 2.17-5.29 5.01.06.77.12 1.54.18 2.31" />
                  </svg>
                  {tool.toolName}
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={props.message.thinking}>
          <span class="loading loading-dots loading-sm mt-2"></span>
        </Show>
      </div>
    </div>
  )
}

function PermissionRequestCard(props: {
  permission: PermissionRequest
  onApprove: () => void
  onDeny: () => void
  onApproveForSession: () => void
}) {
  return (
    <div class="alert alert-warning shadow-lg mx-4 max-w-2xl">
      <WarningIcon />
      <div class="flex-1">
        <h3 class="font-bold">Permission Request</h3>
        <div class="text-sm opacity-80">{props.permission.description}</div>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <button
          onClick={props.onApprove}
          class="btn btn-success btn-sm"
        >
          <CheckIcon />
          Approve Once
        </button>
        <button
          onClick={props.onApproveForSession}
          class="btn btn-primary btn-sm"
        >
          <CheckIcon />
          Approve Session
        </button>
        <button
          onClick={props.onDeny}
          class="btn btn-error btn-sm"
        >
          <XIcon />
          Deny
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ChatView(props: ChatViewProps) {
  const messages = () => chatStore.getMessages(props.sessionId)
  const pendingPermissions = () => chatStore.getPendingPermissions(props.sessionId)
  const [inputValue, setInputValue] = createSignal('')
  const [messagesEnd, setMessagesEnd] = createSignal<HTMLDivElement | null>(null)
  const [isScrolledToBottom, setIsScrolledToBottom] = createSignal(true)

  // Remote spawn state
  const [showSpawnModal, setShowSpawnModal] = createSignal(false)
  const [spawnAgentType, setSpawnAgentType] = createSignal<AgentType>('claude')
  const [spawnProjectPath, setSpawnProjectPath] = createSignal('')
  const [spawnArgs, setSpawnArgs] = createSignal('')
  const [isSpawning, setIsSpawning] = createSignal(false)

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    messages()
    pendingPermissions()

    if (isScrolledToBottom()) {
      scrollToBottom()
    }
  })

  // Listen for incoming agent messages from backend
  onMount(() => {
    const unlisten = listen<string>('agent-message', (event) => {
      try {
        const data = JSON.parse(event.payload)
        if (data.sessionId === props.sessionId) {
          // Handle different message types
          if (data.type === 'response') {
            chatStore.addMessage(props.sessionId, {
              role: 'assistant',
              content: data.content || '',
              thinking: data.thinking || false,
              messageId: data.messageId,
            })
          } else if (data.type === 'permission_request') {
            chatStore.addPermissionRequest(props.sessionId, {
              sessionId: props.sessionId,
              toolName: data.toolName,
              toolParams: data.toolParams,
              description: data.description || `Permission request for ${data.toolName}`,
            })
          }
        }
      } catch (e) {
        console.error('Failed to parse agent message:', e)
      }
    })

    return () => {
      unlisten.then(fn => fn())
    }
  })

  const scrollToBottom = () => {
    messagesEnd()?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    const content = inputValue().trim()
    if (!content) return

    setInputValue('')

    // Check if it's a slash command
    if (content.startsWith('/')) {
      try {
        // Send slash command via Tauri
        await invoke('send_slash_command', {
          sessionId: props.sessionId,
          command: content,
        })
        // Add system message showing the command was sent
        chatStore.addMessage(props.sessionId, {
          role: 'system',
          content: `Command sent: ${content}`,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to send command'
        notificationStore.error(errorMsg, 'Command Error')
        chatStore.addMessage(props.sessionId, {
          role: 'system',
          content: `Error: ${errorMsg}`,
        })
      }
    } else {
      // Regular message
      chatStore.addMessage(props.sessionId, {
        role: 'user',
        content,
      })

      props.onSendMessage?.(content)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePermissionResponse = (
    permissionId: string,
    response: 'approved' | 'denied' | 'approved_for_session',
  ) => {
    chatStore.respondToPermission(props.sessionId, permissionId, response)
    chatStore.clearPermission(props.sessionId, permissionId)
    props.onPermissionResponse?.(permissionId, response)
  }

  // Handle remote spawn
  const handleSpawnSession = async () => {
    const projectPath = spawnProjectPath().trim()
    if (!projectPath) {
      notificationStore.error('Please enter a project path', 'Spawn Session')
      return
    }

    setIsSpawning(true)
    try {
      const args = spawnArgs().trim().split(/\s+/).filter(Boolean)
      props.onSpawnRemoteSession?.(spawnAgentType(), projectPath, args)
      notificationStore.success(`New ${spawnAgentType()} session created`, 'Spawn Session')
      setShowSpawnModal(false)
      setSpawnProjectPath('')
      setSpawnArgs('')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to spawn session'
      notificationStore.error(errorMsg, 'Spawn Session Error')
    } finally {
      setIsSpawning(false)
    }
  }

  // Get agent icon
  const getAgentIcon = () => {
    switch (props.agentType) {
      case 'opencode':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2L2 7l8 5 8-5-8-5zM2 17l8 5 8-5M2 12l8 5 8-5" />
          </svg>
        )
      case 'gemini':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
        )
    }
  }

  return (
    <div class="flex flex-col h-full bg-base-200">
      {/* Header */}
      <div class="navbar bg-base-100 border-b border-base-300 px-4 py-3">
        <div class="flex-1">
          <div class="flex items-center gap-3">
            <div class="text-primary">{getAgentIcon()}</div>
            <div>
              <h2 class="text-lg font-semibold">
                {props.agentType === 'claude' && 'Claude Code'}
                {props.agentType === 'opencode' && 'OpenCode'}
                {props.agentType === 'gemini' && 'Gemini CLI'}
                {props.agentType === 'custom' && 'Custom Agent'}
              </h2>
              <div class="text-xs text-base-content/50">Session: {props.sessionId.slice(0, 8)}</div>
            </div>
          </div>
        </div>
        <div class="flex-none">
          <button
            onClick={() => setShowSpawnModal(true)}
            class="btn btn-primary btn-sm gap-2"
          >
            <PlusIcon />
            <span class="hidden sm:inline">New Session</span>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        class="flex-1 overflow-y-auto px-4 py-6"
        onScroll={(e) => {
          const target = e.target as HTMLElement
          const isAtBottom =
            target.scrollHeight - target.scrollTop - target.clientHeight < 100
          setIsScrolledToBottom(isAtBottom)
        }}
      >
        <Show when={messages().length === 0 && pendingPermissions().length === 0}>
          <div class="flex flex-col items-center justify-center h-full text-center">
            <div class="card bg-base-100 shadow-xl max-w-md">
              <div class="card-body">
                <div class="text-6xl mb-4">💬</div>
                <h3 class="card-title text-primary justify-center">Start a conversation</h3>
                <p class="text-base-content/70">
                  Ask your AI agent to help with coding tasks, explain code, or make changes to your project.
                </p>
              </div>
            </div>
          </div>
        </Show>

        {/* Permission Requests */}
        <For each={pendingPermissions()}>
          {(permission) => (
            <PermissionRequestCard
              permission={permission}
              onApprove={() => handlePermissionResponse(permission.id, 'approved')}
              onDeny={() => handlePermissionResponse(permission.id, 'denied')}
              onApproveForSession={() => handlePermissionResponse(permission.id, 'approved_for_session')}
            />
          )}
        </For>

        {/* Messages */}
        <div class="space-y-4 mb-4">
          <For each={messages()}>
            {(message) => <MessageBubble message={message} />}
          </For>
        </div>

        <div ref={setMessagesEnd} />
      </div>

      {/* Scroll to bottom button */}
      <Show when={!isScrolledToBottom() && messages().length > 0}>
        <button
          onClick={scrollToBottom}
          class="btn btn-circle btn-sm fixed bottom-24 right-6 shadow-lg z-10"
          aria-label="Scroll to bottom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </Show>

      {/* Input Area */}
      <div class="card-actions bg-base-100 border-t border-base-300 px-4 py-4">
        <div class="join w-full">
          <input
            type="text"
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            class="input input-bordered join-item flex-1"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue().trim()}
            class="btn btn-primary join-item"
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
        <div class="mt-2 text-center">
          <span class="text-xs text-base-content/50">
            Press <kbd class="kbd kbd-sm">Enter</kbd> to send, <kbd class="kbd kbd-sm">Shift + Enter</kbd> for new line
          </span>
        </div>
      </div>

      {/* Remote Spawn Modal */}
      <Show when={showSpawnModal()}>
        <dialog class="modal modal-open">
          <div class="modal-box max-w-md">
            <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
              <PlusIcon />
              Spawn New Remote Session
            </h3>

            {/* Agent Type Selection */}
            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text font-semibold">Agent Type</span>
              </label>
              <select
                class="select select-bordered w-full"
                value={spawnAgentType()}
                onInput={(e) => setSpawnAgentType(e.currentTarget.value as AgentType)}
              >
                <option value="claude">Claude Code</option>
                <option value="opencode">OpenCode</option>
                <option value="gemini">Gemini CLI</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Project Path */}
            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text font-semibold">Project Path</span>
              </label>
              <input
                type="text"
                placeholder="/path/to/project"
                class="input input-bordered w-full font-mono"
                value={spawnProjectPath()}
                onInput={(e) => setSpawnProjectPath(e.currentTarget.value)}
              />
              <label class="label">
                <span class="label-text-alt">Absolute path to the project directory</span>
              </label>
            </div>

            {/* Additional Args */}
            <div class="form-control mb-6">
              <label class="label">
                <span class="label-text font-semibold">Additional Arguments (Optional)</span>
              </label>
              <input
                type="text"
                placeholder="--arg1 value1 --arg2 value2"
                class="input input-bordered w-full font-mono"
                value={spawnArgs()}
                onInput={(e) => setSpawnArgs(e.currentTarget.value)}
              />
              <label class="label">
                <span class="label-text-alt">Space-separated arguments for the agent</span>
              </label>
            </div>

            {/* Actions */}
            <div class="modal-action">
              <button
                class="btn btn-ghost"
                onClick={() => setShowSpawnModal(false)}
                disabled={isSpawning()}
              >
                Cancel
              </button>
              <button
                class="btn btn-primary"
                onClick={handleSpawnSession}
                disabled={isSpawning() || !spawnProjectPath().trim()}
              >
                <Show when={isSpawning()}>
                  <span class="loading loading-spinner loading-sm"></span>
                </Show>
                Spawn Session
              </button>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button onClick={() => !isSpawning() && setShowSpawnModal(false)}>close</button>
          </form>
        </dialog>
      </Show>
    </div>
  )
}

export default ChatView
