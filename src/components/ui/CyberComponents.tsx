import { JSX, children, createSignal } from 'solid-js';

// Terminal Button Component
export interface CyberButtonProps {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  glow?: boolean;
  onClick?: () => void;
  class?: string;
  children: JSX.Element;
}

export function CyberButton(props: CyberButtonProps) {
  const [isPressed, setIsPressed] = createSignal(false);
  
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);
  
  const baseClasses = 'btn btn-cyber font-mono relative overflow-hidden transition-all duration-300';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary', 
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    error: 'btn-error',
    warning: 'btn-warning'
  };
  
  const sizeClasses = {
    sm: 'btn-sm px-3 py-1 text-xs',
    md: 'btn-md px-4 py-2 text-sm', 
    lg: 'btn-lg px-6 py-3 text-base'
  };
  
  const glowClass = props.glow ? 'animate-glow-pulse' : '';
  const pressedClass = isPressed() ? 'scale-95 brightness-110' : '';
  
  return (
    <button
      class={`${baseClasses} ${variantClasses[props.variant || 'primary']} ${sizeClasses[props.size || 'md']} ${glowClass} ${pressedClass} ${props.class || ''}`}
      classList={{
        'loading': props.loading,
        'btn-disabled': props.disabled
      }}
      disabled={props.disabled || props.loading}
      onClick={props.onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {props.loading && <span class="loading loading-spinner loading-sm mr-2"></span>}
      {props.children}
    </button>
  );
}

// Terminal Input Component
export interface CyberInputProps {
  type?: 'text' | 'password' | 'email' | 'url';
  placeholder?: string;
  value?: string;
  onInput?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  success?: string;
  prefix?: JSX.Element;
  suffix?: JSX.Element;
  glow?: boolean;
  class?: string;
}

export function CyberInput(props: CyberInputProps) {
  const [focused, setFocused] = createSignal(false);
  
  const baseClasses = 'input input-cyber w-full font-mono transition-all duration-300';
  const glowClass = props.glow ? 'terminal-glow' : '';
  const focusClass = focused() ? 'ring-2 ring-current ring-opacity-50' : '';
  const errorClass = props.error ? 'border-error text-error' : '';
  const successClass = props.success ? 'border-success text-success' : '';
  
  return (
    <div class="form-control w-full">
      <div class="relative">
        {props.prefix && (
          <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-current opacity-70">
            {props.prefix}
          </div>
        )}
        <input
          type={props.type || 'text'}
          placeholder={props.placeholder}
          value={props.value || ''}
          onInput={(e) => props.onInput?.(e.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={props.disabled}
          class={`${baseClasses} ${glowClass} ${focusClass} ${errorClass} ${successClass} ${props.class || ''} ${props.prefix ? 'pl-10' : ''} ${props.suffix ? 'pr-10' : ''}`}
        />
        {props.suffix && (
          <div class="absolute right-3 top-1/2 transform -translate-y-1/2 text-current opacity-70">
            {props.suffix}
          </div>
        )}
      </div>
      {props.error && (
        <label class="label">
          <span class="label-text-alt text-error font-mono">⚠ {props.error}</span>
        </label>
      )}
      {props.success && (
        <label class="label">
          <span class="label-text-alt text-success font-mono">✓ {props.success}</span>
        </label>
      )}
    </div>
  );
}

// Terminal Card Component  
export interface CyberCardProps {
  title?: string;
  subtitle?: string;
  children: JSX.Element;
  actions?: JSX.Element;
  glow?: boolean;
  scan?: boolean;
  class?: string;
}

export function CyberCard(props: CyberCardProps) {
  const baseClasses = 'card card-cyber font-mono';
  const glowClass = props.glow ? 'animate-glow-pulse' : '';
  const scanClass = props.scan ? 'progressive-scan' : '';
  
  return (
    <div class={`${baseClasses} ${glowClass} ${scanClass} ${props.class || ''}`}>
      <div class="card-body">
        {(props.title || props.subtitle) && (
          <div class="card-title-section mb-4">
            {props.title && (
              <h2 class="card-title text-current font-mono text-lg terminal-glow">
                {props.title}
              </h2>
            )}
            {props.subtitle && (
              <p class="text-current opacity-70 text-sm font-mono">
                {props.subtitle}
              </p>
            )}
          </div>
        )}
        <div class="card-content">
          {props.children}
        </div>
        {props.actions && (
          <div class="card-actions justify-end mt-4 pt-4 border-t border-current border-opacity-20">
            {props.actions}
          </div>
        )}
      </div>
    </div>
  );
}

// Terminal Select Component
export interface CyberSelectProps {
  options: { value: string; label: string }[];
  value?: string;
  placeholder?: string;
  onSelect?: (value: string) => void;
  disabled?: boolean;
  class?: string;
}

export function CyberSelect(props: CyberSelectProps) {
  const baseClasses = 'select select-bordered w-full font-mono bg-transparent border-current';
  
  return (
    <select
      class={`${baseClasses} ${props.class || ''}`}
      value={props.value || ''}
      onChange={(e) => props.onSelect?.(e.currentTarget.value)}
      disabled={props.disabled}
    >
      {props.placeholder && (
        <option disabled value="">{props.placeholder}</option>
      )}
      {props.options.map(option => (
        <option value={option.value} class="bg-base-100">
          {option.label}
        </option>
      ))}
    </select>
  );
}

// Terminal Toggle Component
export interface CyberToggleProps {
  checked?: boolean;
  onToggle?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  class?: string;
}

export function CyberToggle(props: CyberToggleProps) {
  const baseClasses = 'toggle toggle-primary';
  
  return (
    <div class={`form-control ${props.class || ''}`}>
      <label class="label cursor-pointer">
        <div class="flex-1">
          {props.label && (
            <span class="label-text font-mono text-current">{props.label}</span>
          )}
          {props.description && (
            <div class="text-xs font-mono text-current opacity-70 mt-1">
              {props.description}
            </div>
          )}
        </div>
        <input
          type="checkbox"
          class={baseClasses}
          checked={props.checked || false}
          onChange={(e) => props.onToggle?.(e.currentTarget.checked)}
          disabled={props.disabled}
        />
      </label>
    </div>
  );
}

// Terminal Progress Bar
export interface CyberProgressProps {
  value: number; // 0-100
  label?: string;
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
  animated?: boolean;
  class?: string;
}

export function CyberProgress(props: CyberProgressProps) {
  const baseClasses = 'progress font-mono';
  const colorClasses = {
    primary: 'progress-primary',
    secondary: 'progress-secondary',
    accent: 'progress-accent', 
    success: 'progress-success',
    warning: 'progress-warning',
    error: 'progress-error'
  };
  
  const colorClass = colorClasses[props.color || 'primary'];
  const animatedClass = props.animated ? 'animate-pulse' : '';
  
  return (
    <div class={props.class}>
      {props.label && (
        <div class="flex justify-between text-sm font-mono mb-1">
          <span>{props.label}</span>
          <span>{props.value}%</span>
        </div>
      )}
      <progress 
        class={`${baseClasses} ${colorClass} ${animatedClass} w-full terminal-glow`}
        value={props.value} 
        max="100"
      />
    </div>
  );
}

// Terminal Alert/Notification
export interface CyberAlertProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  class?: string;
}

export function CyberAlert(props: CyberAlertProps) {
  const baseClasses = 'alert font-mono border-current terminal-glow';
  const typeClasses = {
    info: 'alert-info',
    success: 'alert-success', 
    warning: 'alert-warning',
    error: 'alert-error'
  };
  
  const icons = {
    info: '🛈',
    success: '✓',
    warning: '⚠',
    error: '✗'
  };
  
  return (
    <div class={`${baseClasses} ${typeClasses[props.type]} ${props.class || ''}`}>
      <span class="text-xl">{icons[props.type]}</span>
      <div class="flex-1">
        {props.title && (
          <div class="font-bold">{props.title}</div>
        )}
        <div class="text-sm">{props.message}</div>
      </div>
      {props.dismissible && (
        <button 
          class="btn btn-ghost btn-sm"
          onClick={props.onDismiss}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Terminal Loading Spinner
export interface CyberSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  class?: string;
}

export function CyberSpinner(props: CyberSpinnerProps) {
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
        <span class="font-mono text-current">{props.label}</span>
      )}
    </div>
  );
}

// Terminal Modal/Dialog
export interface CyberModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: JSX.Element;
  actions?: JSX.Element;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  class?: string;
}

export function CyberModal(props: CyberModalProps) {
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
      <div class={`modal-box card-cyber ${sizeClasses[props.size || 'md']} ${props.class || ''}`}>
        <div class="flex items-center justify-between mb-4">
          {props.title && (
            <h3 class="font-bold text-lg font-mono terminal-glow">
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
        
        <div class="modal-content">
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