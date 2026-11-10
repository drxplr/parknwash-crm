// Shared contract: exact Meta bodies, positional parameters and synthetic test data.
// No customer data is accepted by the test sender.
export const bookingTemplates = [
  {
    kind: 'confirmation',
    name: 'parknwash_booking_confirmation',
    title: 'Booking confirmation',
    body: 'Hi {{1}}, your Park n Wash booking is confirmed: {{2}} for {{3}} on {{4}} at {{5}} (Europe/Zurich), at {{6}}. Thank you. The Park n Wash team.',
  },
  {
    kind: 'reminder',
    name: 'parknwash_appointment_reminder',
    title: 'Appointment reminder',
    body: 'Hi {{1}}, a reminder of your Park n Wash appointment: {{2}} for {{3}} on {{4}} at {{5}} (Europe/Zurich), at {{6}}. Thank you. The Park n Wash team.',
  },
] as const
export type BookingMessageKind = (typeof bookingTemplates)[number]['kind']
export type TestMessageKind = 'connection' | BookingMessageKind
export const templateSamples = [
  'Test customer',
  'Complete Care',
  'Test vehicle',
  '20 November 2026',
  '10:00',
  'Test address',
]
export function renderBookingMessage(kind: BookingMessageKind, parameters: string[]) {
  return bookingTemplates
    .find((t) => t.kind === kind)!
    .body.replace(/\{\{(\d)\}\}/g, (_, n: string) => parameters[Number(n) - 1] ?? '')
}
