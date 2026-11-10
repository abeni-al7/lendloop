// Mock email: build the notice and log it. Swap this node for a real email node in production.
const { event } = $input.first().json;
const { loan, recipient, otherParty } = event;
const days = `${loan.startDate} to ${loan.endDate}`;
const subjects = {
  'loan.requested': `${otherParty.firstName} wants to borrow your ${loan.tool.name}`,
  approved: `${otherParty.firstName} said yes: ${loan.tool.name}`,
  declined: `${otherParty.firstName} can't lend the ${loan.tool.name} this time`,
  returned: `Thanks for returning the ${loan.tool.name}`,
};
const subject = event.event === 'loan.requested' ? subjects['loan.requested'] : subjects[loan.status] ?? `Update on ${loan.tool.name}`;
const text = `Hi ${recipient.firstName},\n\n${subject} (${loan.tool.ref}, ${days}).\nOpen LendLoop to see the details.`;
console.log(`[mock email] to=${recipient.email ?? 'no-email'} subject="${subject}"`);
return [{ json: { event, mail: { to: recipient.email, subject, text, sentAt: new Date().toISOString() } } }];
