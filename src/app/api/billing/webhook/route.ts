import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '../../../../../lib/prisma';
import { getStripe, PLAN_CONFIG } from '../../../../../lib/stripe';
import { logError, logEvent } from '../../../../../lib/observability';
export const runtime = 'nodejs';
function planFromPrice(priceId?: string | null) { for (const [plan,c] of Object.entries(PLAN_CONFIG)) if (process.env[c.priceEnv]===priceId || process.env[c.priceEnv.replace('_MONTHLY','_ANNUAL')]===priceId) return plan; return null; }
export async function POST(req: NextRequest) {
 const secret=process.env.STRIPE_WEBHOOK_SECRET; if(!secret) return NextResponse.json({error:'STRIPE_WEBHOOK_SECRET is not configured.'},{status:503});
 try {
  const stripe=getStripe(); const raw=await req.text(); const sig=req.headers.get('stripe-signature');
  if(!sig) return NextResponse.json({error:'Missing Stripe signature.'},{status:400});
  const event=stripe.webhooks.constructEvent(raw,sig,secret);
  const existing=await prisma.processedWebhookEvent.findUnique({where:{eventId:event.id}});
  if(existing) { logEvent('stripe.webhook.duplicate',{eventId:event.id,eventType:event.type}); return NextResponse.json({received:true,duplicate:true}); }
  if(event.type==='checkout.session.completed') {
    const s=event.data.object as Stripe.Checkout.Session; const orgId=s.metadata?.organizationId;
    if(orgId&&s.customer) await prisma.organization.update({where:{id:orgId},data:{stripeCustomerId:String(s.customer),stripeSubscriptionId:s.subscription?String(s.subscription):undefined,planStatus:'active'}});
  }
  if(event.type.startsWith('customer.subscription.')) {
    const sub=event.data.object as Stripe.Subscription; const price=sub.items.data[0]?.price.id; const plan=planFromPrice(price); const status=sub.status;
    const currentEnd=(sub as any).current_period_end ? new Date((sub as any).current_period_end*1000) : null; const cancel=(sub as any).cancel_at_period_end ?? false;
    const data:any={stripeSubscriptionId:sub.id,planStatus:status,currentPeriodEnd:currentEnd,cancelAtPeriodEnd:cancel,subscriptionPriceId:price||null,billingInterval:sub.items.data[0]?.price.recurring?.interval||null};
    if(plan){data.plan=plan;data.leadLimit=PLAN_CONFIG[plan].leadLimit;data.seatLimit=PLAN_CONFIG[plan].seatLimit;data.automationRunLimit=PLAN_CONFIG[plan].automationRunLimit;}
    await prisma.organization.updateMany({where:{stripeCustomerId:String(sub.customer)},data});
  }
  await prisma.processedWebhookEvent.create({data:{provider:'stripe',eventId:event.id,eventType:event.type}});
  logEvent('stripe.webhook.processed',{eventId:event.id,eventType:event.type});
  return NextResponse.json({received:true});
 } catch(e:any) { logError('stripe.webhook.error',e); return NextResponse.json({error:'Webhook processing failed.'},{status:400}); }
}
