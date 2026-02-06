/**
 * Notification Store
 *
 * Manages P2P push notifications including:
 * - Notification queue
 * - Display state
 * - Auto-dismiss behavior
 */

import { createStore, produce } from 'solid-js/store'

// ============================================================================
// Types
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Notification {
  id: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  timestamp: number
  read: boolean
  dismissed: boolean
  duration?: number // Auto-dismiss duration in ms (0 = no auto-dismiss)
  actions?: NotificationAction[]
  metadata?: Record<string, unknown>
}

export interface NotificationAction {
  label: string
  action: () => void
  primary?: boolean
}

// ============================================================================
// Store
// ============================================================================

interface NotificationState {
  notifications: Notification[]
  visible: boolean
  queuePosition: number
  maxVisible: number
}

const initialState: NotificationState = {
  notifications: [],
  visible: false,
  queuePosition: 0,
  maxVisible: 3,
}

export const createNotificationStore = () => {
  const [state, setState] = createStore<NotificationState>(initialState)

  // ========================================================================
  // Add Notifications
  // ========================================================================

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'dismissed'>) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      read: false,
      dismissed: false,
      duration: notification.duration ?? (notification.priority === 'urgent' ? 0 : 5000),
    }

    setState(
      produce((s: NotificationState) => {
        s.notifications.unshift(newNotification)
        s.visible = true
      }),
    )

    // Auto-dismiss if duration is set
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        dismissNotification(id)
      }, newNotification.duration)
    }

    return id
  }

  // Convenience methods for common notification types
  const info = (message: string, title?: string, duration?: number) => {
    return addNotification({
      type: 'info',
      priority: 'normal',
      title: title ?? 'Info',
      message,
      duration,
    })
  }

  const success = (message: string, title?: string, duration?: number) => {
    return addNotification({
      type: 'success',
      priority: 'normal',
      title: title ?? 'Success',
      message,
      duration: duration ?? 3000,
    })
  }

  const warning = (message: string, title?: string, duration?: number) => {
    return addNotification({
      type: 'warning',
      priority: 'high',
      title: title ?? 'Warning',
      message,
      duration,
    })
  }

  const error = (message: string, title?: string, duration?: number) => {
    return addNotification({
      type: 'error',
      priority: 'urgent',
      title: title ?? 'Error',
      message,
      duration: duration ?? 0,
    })
  }

  // ========================================================================
  // Manage Notifications
  // ========================================================================

  const dismissNotification = (id: string) => {
    setState(
      produce((s: NotificationState) => {
        const notif = s.notifications.find((n) => n.id === id)
        if (notif) {
          notif.dismissed = true
        }
      }),
    )

    // Remove from list after animation
    setTimeout(() => {
      setState(
        produce((s: NotificationState) => {
          s.notifications = s.notifications.filter((n) => n.id !== id)
          s.visible = s.notifications.length > 0
        }),
      )
    }, 300)
  }

  const dismissAll = () => {
    setState(
      produce((s: NotificationState) => {
        s.notifications.forEach((n) => (n.dismissed = true))
      }),
    )

    setTimeout(() => {
      setState(
        produce((s: NotificationState) => {
          s.notifications = []
          s.visible = false
        }),
      )
    }, 300)
  }

  const markAsRead = (id: string) => {
    setState(
      produce((s: NotificationState) => {
        const notif = s.notifications.find((n) => n.id === id)
        if (notif) {
          notif.read = true
        }
      }),
    )
  }

  const markAllAsRead = () => {
    setState(
      produce((s: NotificationState) => {
        s.notifications.forEach((n) => (n.read = true))
      }),
    )
  }

  const removeNotification = (id: string) => {
    setState(
      produce((s: NotificationState) => {
        s.notifications = s.notifications.filter((n) => n.id !== id)
        s.visible = s.notifications.length > 0
      }),
    )
  }

  const clear = () => {
    setState({
      notifications: [],
      visible: false,
      queuePosition: 0,
    })
  }

  // ========================================================================
  // Actions
  // ========================================================================

  const executeAction = (id: string, actionIndex: number) => {
    const notif = state.notifications.find((n) => n.id === id)
    if (notif?.actions?.[actionIndex]) {
      notif.actions[actionIndex].action()
      dismissNotification(id)
    }
  }

  // ========================================================================
  // Derived State
  // ========================================================================

  const getVisibleNotifications = (): Notification[] => {
    return state.notifications.filter((n) => !n.dismissed).slice(0, state.maxVisible)
  }

  const getUnreadCount = (): number => {
    return state.notifications.filter((n) => !n.read && !n.dismissed).length
  }

  const getByPriority = (priority: NotificationPriority): Notification[] => {
    return state.notifications.filter((n) => n.priority === priority && !n.dismissed)
  }

  return {
    // State
    state,

    // Add
    addNotification,
    info,
    success,
    warning,
    error,

    // Manage
    dismissNotification,
    dismissAll,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clear,

    // Actions
    executeAction,

    // Derived
    getVisibleNotifications,
    getUnreadCount,
    getByPriority,
  }
}

// Global store instance
export const notificationStore = createNotificationStore()
