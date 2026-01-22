/**
 * Ticket parser utilities
 * 提供票据解析和格式化功能
 */

/**
 * 获取票据的显示ID（截取票据的前12个字符用于显示）
 * Get a display-friendly version of the ticket (first 12 characters)
 */
export function getTicketDisplayId(ticket: string): string {
  if (!ticket || ticket.length <= 12) {
    return ticket;
  }
  return ticket.substring(0, 12);
}

/**
 * 验证票据格式是否有效
 * Validate if a ticket string has a valid format
 */
export function isValidTicket(ticket: string): boolean {
  if (!ticket || ticket.length < 12) {
    return false;
  }
  // Basic validation - tickets should be alphanumeric with possible dashes
  const ticketRegex = /^[a-zA-Z0-9_-]+$/;
  return ticketRegex.test(ticket);
}

/**
 * 格式化票据用于显示（如果票据很长，显示前部分和后部分）
 * Format ticket for display (show prefix and suffix if long)
 */
export function formatTicketForDisplay(
  ticket: string,
  prefixLength: number = 8,
  suffixLength: number = 4,
): string {
  if (!ticket || ticket.length <= prefixLength + suffixLength) {
    return ticket;
  }
  const prefix = ticket.substring(0, prefixLength);
  const suffix = ticket.substring(ticket.length - suffixLength);
  return `${prefix}...${suffix}`;
}
