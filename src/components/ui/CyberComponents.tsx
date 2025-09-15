import { JSX } from 'solid-js';

// 简化的按钮组件
export interface SimpleButtonProps {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  class?: string;
  children: JSX.Element;
}

export function SimpleButton(props: SimpleButtonProps) {
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary', 
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    error: 'btn-error',
    warning: 'btn-warning'
  };
  
  return (
    <button
      class={`btn btn-${props.size || 'md'} ${variantClasses[props.variant || 'primary']} ${props.class || ''}`}
      classList={{
        'loading': props.loading,
        'btn-disabled': props.disabled
      }}
      disabled={props.disabled || props.loading}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

// 兼容性别名
export const CyberButton = SimpleButton;

// 简化的输入框组件
export interface SimpleInputProps {
  type?: 'text' | 'password' | 'email' | 'url';
  placeholder?: string;
  value?: string;
  onInput?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  success?: string;
  class?: string;
}

export function SimpleInput(props: SimpleInputProps) {
  return (
    <div class="form-control w-full">
      <input
        type={props.type || 'text'}
        placeholder={props.placeholder}
        value={props.value || ''}
        onInput={(e) => props.onInput?.(e.currentTarget.value)}
        disabled={props.disabled}
        class={`input input-bordered w-full ${props.class || ''}`}
      />
      {props.error && (
        <label class="label">
          <span class="label-text-alt text-error">{props.error}</span>
        </label>
      )}
      {props.success && (
        <label class="label">
          <span class="label-text-alt text-success">{props.success}</span>
        </label>
      )}
    </div>
  );
}

// 兼容性别名
export const CyberInput = SimpleInput;

// 简化的卡片组件  
export interface SimpleCardProps {
  title?: string;
  subtitle?: string;
  children: JSX.Element;
  actions?: JSX.Element;
  class?: string;
}

export function SimpleCard(props: SimpleCardProps) {
  return (
    <div class={`card bg-base-100 shadow-md ${props.class || ''}`}>
      <div class="card-body">
        {props.title && (
          <h2 class="card-title">{props.title}</h2>
        )}
        {props.subtitle && (
          <p class="text-sm text-base-content opacity-70">{props.subtitle}</p>
        )}
        <div class="mt-4">
          {props.children}
        </div>
        {props.actions && (
          <div class="card-actions justify-end mt-4">
            {props.actions}
          </div>
        )}
      </div>
    </div>
  );
}

// 兼容性别名
export const CyberCard = SimpleCard;

// 简化的选择框组件
export interface SimpleSelectProps {
  options: { value: string; label: string }[];
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  class?: string;
}

export function SimpleSelect(props: SimpleSelectProps) {
  return (
    <select
      class={`select select-bordered w-full ${props.class || ''}`}
      value={props.value || ''}
      onChange={(e) => props.onChange?.(e.currentTarget.value)}
      disabled={props.disabled}
    >
      {props.placeholder && (
        <option disabled value="">{props.placeholder}</option>
      )}
      {props.options.map(option => (
        <option value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// 兼容性别名
export const CyberSelect = SimpleSelect;

// 简化的切换组件
export interface SimpleToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  class?: string;
}

export function SimpleToggle(props: SimpleToggleProps) {
  return (
    <div class={`form-control ${props.class || ''}`}>
      <label class="label cursor-pointer">
        {props.label && (
          <span class="label-text">{props.label}</span>
        )}
        <input
          type="checkbox"
          class="toggle toggle-primary"
          checked={props.checked || false}
          onChange={(e) => props.onChange?.(e.currentTarget.checked)}
          disabled={props.disabled}
        />
      </label>
    </div>
  );
}

// 兼容性别名
export const CyberToggle = SimpleToggle;

// 简化的进度条组件
export interface SimpleProgressProps {
  value: number; // 0-100
  label?: string;
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
  class?: string;
}

export function SimpleProgress(props: SimpleProgressProps) {
  const colorClasses = {
    primary: 'progress-primary',
    secondary: 'progress-secondary',
    accent: 'progress-accent', 
    success: 'progress-success',
    warning: 'progress-warning',
    error: 'progress-error'
  };
  
  const colorClass = colorClasses[props.color || 'primary'];
  
  return (
    <div class={props.class}>
      {props.label && (
        <div class="flex justify-between text-sm mb-1">
          <span>{props.label}</span>
          <span>{props.value}%</span>
        </div>
      )}
      <progress 
        class={`progress w-full ${colorClass}`}
        value={props.value} 
        max="100"
      />
    </div>
  );
}

// 兼容性别名
export const CyberProgress = SimpleProgress;

// 简化的警告组件
export interface SimpleAlertProps {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  class?: string;
}

export function SimpleAlert(props: SimpleAlertProps) {
  return (
    <div class={`alert alert-${props.type} ${props.class || ''}`}>
      <span>{props.message}</span>
    </div>
  );
}

// 兼容性别名
export const CyberAlert = SimpleAlert;

// 简化的加载组件
export interface SimpleSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  class?: string;
}

export function SimpleSpinner(props: SimpleSpinnerProps) {
  const sizeClasses = {
    sm: 'loading-sm',
    md: 'loading-md',
    lg: 'loading-lg'
  };
  
  const sizeClass = sizeClasses[props.size || 'md'];
  
  return (
    <div class={`flex items-center gap-3 ${props.class || ''}`}>
      <span class={`loading loading-spinner ${sizeClass} text-primary`}></span>
      {props.label && (
        <span>{props.label}</span>
      )}
    </div>
  );
}

// 兼容性别名
export const CyberSpinner = SimpleSpinner;

// 简化的模态框组件
export interface SimpleModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: JSX.Element;
  actions?: JSX.Element;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  class?: string;
}

export function SimpleModal(props: SimpleModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg', 
    xl: 'max-w-xl'
  };
  
  return (
    <div 
      class={`modal ${props.open ? 'modal-open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          props.onClose();
        }
      }}
    >
      <div class={`modal-box ${sizeClasses[props.size || 'md']} ${props.class || ''}`}>
        <div class="flex items-center justify-between mb-4">
          {props.title && (
            <h3 class="font-bold text-lg">
              {props.title}
            </h3>
          )}
          <button 
            class="btn btn-sm btn-circle btn-ghost"
            onClick={props.onClose}
          >
            ✕
          </button>
        </div>
        
        <div class="modal-content py-4">
          {props.children}
        </div>
        
        {props.actions && (
          <div class="modal-action">
            {props.actions}
          </div>
        )}
      </div>
    </div>
  );
}

// 兼容性别名
export const CyberModal = SimpleModal;