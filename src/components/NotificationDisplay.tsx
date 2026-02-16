/**
 * Notification Display Component
 *
 * Toast-style notifications for P2P push notifications.
 */

import { Component, For, Show } from 'solid-js'
import { notificationStore, Notification } from '../stores/notificationStore'
import { Alert, Button } from './ui/primitives'

// ============================================================================
// Types
// ============================================================================

interface NotificationDisplayProps {
  class?: string
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

// ============================================================================
// Icons
// ============================================================================

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const SuccessIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

const ErrorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

// ============================================================================
// Helper functions
// ============================================================================

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'info': return <InfoIcon />
    case 'success': return <SuccessIcon />
    case 'warning': return <WarningIcon />
    case 'error': return <ErrorIcon />
  }
}

const getNotificationColor = (type: Notification['type']): 'info' | 'success' | 'warning' | 'error' => {
  switch (type) {
    case 'info': return 'info'
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'error': return 'error'
  }
}

const getPositionClasses = (position: string): string => {
  switch (position) {
    case 'top-right': return 'top-4 right-4'
    case 'top-left': return 'top-4 left-4'
    case 'bottom-right': return 'bottom-4 right-4'
    case 'bottom-left': return 'bottom-4 left-4'
    case 'top-center': return 'top-4 left-1/2 -translate-x-1/2'
    case 'bottom-center': return 'bottom-4 left-1/2 -translate-x-1/2'
    default: return 'top-4 right-4'
  }
}

// ============================================================================
// Single Notification Component
// ============================================================================

const NotificationItem = (props: { notification: Notification }) => {
  const { dismissNotification, executeAction } = notificationStore

  const handleDismiss = () => {
    dismissNotification(props.notification.id)
  }

  const handleAction = (index: number) => {
    executeAction(props.notification.id, index)
  }

  return (
    <Alert
      variant={getNotificationColor(props.notification.type)}
      class="relative mb-2 w-full max-w-sm shadow-lg"
      classList={{
        'opacity-0 translate-x-full': props.notification.dismissed,
        'opacity-100 translate-x-0': !props.notification.dismissed
      }}
      style={{
        'transition': 'all 0.3s ease-out'
      }}
    >
      <div class="flex-shrink-0">
        {getNotificationIcon(props.notification.type)}
      </div>

      <div class="flex-1 min-w-0">
        <h4 class="font-semibold text-sm">{props.notification.title}</h4>
        <p class="text-sm opacity-90 break-words">{props.notification.message}</p>

        {/* Actions */}
        <Show when={props.notification.actions && props.notification.actions.length > 0}>
          <div class="flex gap-2 mt-2">
            <For each={props.notification.actions || []}>
              {(action, index) => (
                <Button
                  size="xs"
                  variant={action.primary ? 'primary' : 'ghost'}
                  onClick={() => handleAction(index())}
                >
                  {action.label}
                </Button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Progress bar for auto-dismiss */}
      <Show when={props.notification.duration && props.notification.duration > 0}>
        <div class="absolute bottom-0 left-0 h-1 bg-current opacity-20 animate-[shrink_300ms_linear_forwards]"
          style={{
            'animation-duration': `${props.notification.duration}ms`,
            'width': '100%'
          }}
        />
      </Show>

      {/* Dismiss button */}
      <Button
        size="icon"
        variant="ghost"
        class="h-8 w-8"
        onClick={handleDismiss}
      >
        <CloseIcon />
      </Button>
    </Alert>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export const NotificationDisplay: Component<NotificationDisplayProps> = (props) => {
  const { getVisibleNotifications } = notificationStore

  const visible = () => getVisibleNotifications()
  const position = () => props.position || 'top-right'

  return (
    <div
      class={`notification-container fixed z-50 flex flex-col ${getPositionClasses(position())} ${props.class || ''}`}
    >
      <For each={visible()}>
        {(notification) => <NotificationItem notification={notification} />}
      </For>

      {/* Empty state */}
      <Show when={visible().length === 0}>
        <div class="hidden" />
      </Show>
    </div>
  )
}

export default NotificationDisplay
