require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();

  console.log('Starting manual database seeding...');

  // Clear existing data in correct FK order
  await prisma.activityEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.outreachLog.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create default tenant Organization
  const organization = await prisma.organization.create({
    data: {
      name: 'Straten Agency Inc.',
      slug: 'straten-agency',
      plan: 'GROWTH_PRO',
      planStatus: 'active',
      leadLimit: 500,
      seatLimit: 10,
      currency: 'KES',
    },
  });
  console.log(`Created organization: ${organization.name} (${organization.id})`);

  // Create sample user in organization
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      name: 'Demo User',
      email: 'demo@stratenagency.com',
      password: hashedPassword,
      role: 'ADMIN',
      organizationId: organization.id,
    },
  });
  console.log(`Created user: ${user.email} in org ${organization.name}`);

  // Sample real estate leads data
  const leadsData = [
    {
      companyName: 'Sunset Properties Group',
      contactName: 'Jennifer Martinez',
      jobTitle: 'Senior Real Estate Agent',
      email: 'j.martinez@sunsetproperties.com',
      phone: '(555) 123-4567',
      website: 'www.sunsetproperties.com',
      location: 'Los Angeles, CA',
      businessType: 'RESIDENTIAL_AGENT',
      instagram: '@sunsetproperties',
      linkedin: 'linkedin.com/in/jennifer-martinez-re',
      facebook: 'facebook.com/sunsetproperties',
      leadSource: 'REFERRAL',
      pipelineStage: 'WON',
      outreachStatus: 'REPLIED',
      dealValue: 15000,
      dateAdded: new Date('2024-01-15'),
      lastContact: new Date('2024-08-10'),
      nextFollowUp: new Date('2024-08-20'),
      notes: 'Closed deal for luxury home marketing package. Very satisfied client.'
    },
    {
      companyName: 'Downtown Commercial Realty',
      contactName: 'Robert Chen',
      jobTitle: 'Broker/Owner',
      email: 'rchen@downtowncre.com',
      phone: '(555) 234-5678',
      website: 'www.downtowncre.com',
      location: 'Chicago, IL',
      businessType: 'COMMERCIAL_AGENT',
      linkedin: 'linkedin.com/in/robert-chen-cre',
      facebook: 'facebook.com/downtowncre',
      leadSource: 'COLD_OUTREACH',
      pipelineStage: 'PROPOSAL',
      outreachStatus: 'SENT',
      dealValue: 25000,
      dateAdded: new Date('2024-06-20'),
      lastContact: new Date('2024-08-15'),
      nextFollowUp: new Date('2024-08-22'),
      notes: 'Sent proposal for commercial property marketing campaign. Awaiting response.'
    },
    {
      companyName: 'Prime Property Management',
      contactName: 'Aisha Patel',
      jobTitle: 'Director of Marketing',
      email: 'patel@primepropertymgmt.com',
      phone: '(555) 345-6789',
      website: 'www.primepropertymgmt.com',
      location: 'Miami, FL',
      businessType: 'PROPERTY_MANAGER',
      instagram: '@primepropertymgmt',
      facebook: 'facebook.com/primepropertymgmt',
      leadSource: 'WEBSITE_FORM',
      pipelineStage: 'INTERESTED',
      outreachStatus: 'OPENED',
      dealValue: 12000,
      dateAdded: new Date('2024-07-05'),
      lastContact: new Date('2024-08-12'),
      nextFollowUp: new Date('2024-08-25'),
      notes: 'Opened 3 emails, visited pricing page twice. Interested in social media marketing package.'
    },
    {
      companyName: 'Elite Real Estate Investments',
      contactName: 'Michael Wong',
      jobTitle: 'Founder & CEO',
      email: 'mwong@eliterei.com',
      phone: '(555) 456-7890',
      website: 'www.eliterei.com',
      location: 'New York, NY',
      businessType: 'INVESTOR',
      linkedin: 'linkedin.com/in/michael-wong-rei',
      leadSource: 'SOCIAL_MEDIA',
      pipelineStage: 'FOLLOW_UP',
      outreachStatus: 'SENT',
      dealValue: 30000,
      dateAdded: new Date('2024-05-10'),
      lastContact: new Date('2024-08-08'),
      nextFollowUp: new Date('2024-08-19'),
      notes: 'Followed up on LinkedIn connection request. Interested in investor-focused content marketing.'
    },
    {
      companyName: 'Coastal Homes Realty',
      contactName: 'Sarah Johnson',
      jobTitle: 'Listing Agent',
      email: 'sarah@coastalhomesrealty.com',
      phone: '(555) 567-8901',
      website: 'www.coastalhomesrealty.com',
      location: 'San Diego, CA',
      businessType: 'RESIDENTIAL_AGENT',
      instagram: '@coastalhomes',
      facebook: 'facebook.com/coastalhomesrealty',
      leadSource: 'EVENT',
      pipelineStage: 'CONTACTED',
      outreachStatus: 'PENDING',
      dealValue: 8000,
      dateAdded: new Date('2024-07-22'),
      lastContact: new Date('2024-08-10'),
      nextFollowUp: new Date('2024-08-18'),
      notes: 'Met at CA Real Estate Expo. Exchanged business cards. Initial contact made.'
    },
    {
      companyName: 'Luxury Estates International',
      contactName: 'David Kim',
      jobTitle: 'Partner',
      email: 'david@luxuryestatesintl.com',
      phone: '(555) 678-9012',
      website: 'www.luxuryestatesintl.com',
      location: 'Beverly Hills, CA',
      businessType: 'RESIDENTIAL_AGENT',
      instagram: '@luxuryestatesintl',
      linkedin: 'linkedin.com/in/david-kim-luxuryre',
      facebook: 'facebook.com/luxuryestatesintl',
      leadSource: 'REFERRAL',
      pipelineStage: 'RESEARCHING',
      outreachStatus: 'PENDING',
      dealValue: 20000,
      dateAdded: new Date('2024-08-01'),
      lastContact: null,
      nextFollowUp: new Date('2024-08-28'),
      notes: 'Referral from existing client. Needs research on luxury market positioning.'
    },
    {
      companyName: 'Heartland Property Group',
      contactName: 'Lisa Thompson',
      jobTitle: 'Office Manager',
      email: 'lthompson@heartlandpg.com',
      phone: '(555) 789-0123',
      website: 'www.heartlandpg.com',
      location: 'Indianapolis, IN',
      businessType: 'PROPERTY_MANAGER',
      facebook: 'facebook.com/heartlandpropertygroup',
      leadSource: 'WEBSITE_FORM',
      pipelineStage: 'NEW_LEAD',
      outreachStatus: 'PENDING',
      dealValue: 5000,
      dateAdded: new Date('2024-08-15'),
      lastContact: null,
      nextFollowUp: new Date('2024-08-22'),
      notes: 'Submitted contact form for property management marketing services.'
    },
    {
      companyName: 'Grand View Developments',
      contactName: 'James Wilson',
      jobTitle: 'President',
      email: 'jw@grandviewdev.com',
      phone: '(555) 890-1234',
      website: 'www.grandviewdev.com',
      location: 'Dallas, TX',
      businessType: 'DEVELOPER',
      linkedin: 'linkedin.com/in/james-wilson-dev',
      leadSource: 'COLD_OUTREACH',
      pipelineStage: 'LOST',
      outreachStatus: 'REPLIED',
      dealValue: 0,
      dateAdded: new Date('2024-03-10'),
      lastContact: new Date('2024-07-30'),
      nextFollowUp: null,
      notes: 'Lead went cold after multiple follow-ups. Client chose another agency.'
    }
  ];

  // Create leads
  for (const leadData of leadsData) {
    await prisma.lead.create({
      data: {
        ...leadData,
        organizationId: organization.id,
        assignedToId: user.id,
      },
    });
  }
  console.log(`Created ${leadsData.length} leads in organization`);

  // Create sample outreach logs
  const outreachLogsData = [
    {
      leadId: '', // Will be filled after leads are created
      type: 'email',
      subject: 'Introduction - Straten Agency Marketing Services',
      content: 'Hi Jennifer, I came across your work with Sunset Properties and was impressed...',
      status: 'SENT',
      sentAt: new Date('2024-08-05T10:30:00Z')
    },
    {
      leadId: '',
      type: 'email',
      subject: 'Follow-up: Marketing Proposal for Downtown Commercial',
      content: 'Hi Robert, Just following up on the proposal I sent last week...',
      status: 'SENT',
      sentAt: new Date('2024-08-10T14:15:00Z')
    }
  ];

  // Get actual lead IDs to populate foreign keys
  const leads = await prisma.lead.findMany({ where: { organizationId: organization.id } });
  if (leads.length >= 2) {
    outreachLogsData[0].leadId = leads[0].id;
    outreachLogsData[1].leadId = leads[1].id;

    for (const logData of outreachLogsData) {
      await prisma.outreachLog.create({
        data: logData
      });
    }
    console.log(`Created ${outreachLogsData.length} outreach logs`);
  }

  // Create sample tasks
  const tasksData = [
    {
      leadId: '',
      title: 'Follow up on proposal for Downtown Commercial Realty',
      description: 'Check if Robert has reviewed the proposal and answer any questions',
      dueDate: new Date('2024-08-22'),
      priority: 'high',
      completed: false,
      organizationId: organization.id,
      assignedToId: user.id,
    },
    {
      leadId: '',
      title: 'Prepare social media audit for Prime Property Management',
      description: 'Analyze current social media presence and create improvement recommendations',
      dueDate: new Date('2024-08-25'),
      priority: 'medium',
      completed: false,
      organizationId: organization.id,
      assignedToId: user.id,
    }
  ];

  if (leads.length >= 2) {
    tasksData[0].leadId = leads[1].id; // Downtown Commercial Realty
    tasksData[1].leadId = leads[2].id; // Prime Property Management

    for (const taskData of tasksData) {
      await prisma.task.create({
        data: taskData
      });
    }
    console.log(`Created ${tasksData.length} tasks`);
  }

  // Create sample proposals
  const proposalsData = [
    {
      leadId: '',
      title: 'Commercial Property Marketing Campaign',
      description: 'Comprehensive marketing strategy for downtown commercial properties including LinkedIn, email marketing, and content creation',
      value: 25000,
      status: 'sent',
      sentAt: new Date('2024-08-10'),
      organizationId: organization.id,
    },
    {
      leadId: '',
      title: 'Luxury Home Marketing Package',
      description: 'Premium marketing services for luxury property listings including professional photography, virtual tours, and targeted social media advertising',
      value: 15000,
      status: 'accepted',
      sentAt: new Date('2024-07-20'),
      respondedAt: new Date('2024-08-05'),
      organizationId: organization.id,
    }
  ];

  if (leads.length >= 2) {
    proposalsData[0].leadId = leads[1].id; // Downtown Commercial Realty
    proposalsData[1].leadId = leads[0].id; // Sunset Properties Group

    for (const proposalData of proposalsData) {
      await prisma.proposal.create({
        data: proposalData
      });
    }
    console.log(`Created ${proposalsData.length} proposals`);
  }

  // Create sample activity events
  const activityEventsData = [
    {
      leadId: '',
      type: 'page_view',
      action: 'Viewed pricing page',
      metadata: { page: '/pricing', timeSpent: 45 },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    {
      leadId: '',
      type: 'email_open',
      action: 'Opened outreach email',
      metadata: { emailId: 'outreach_001', device: 'mobile' },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
    }
  ]

  if (leads.length >= 2) {
    activityEventsData[0].leadId = leads[2].id // Prime Property Management
    activityEventsData[1].leadId = leads[0].id // Sunset Properties Group

    for (const eventData of activityEventsData) {
      await prisma.activityEvent.create({
        data: eventData
      })
    }
    console.log(`Created ${activityEventsData.length} activity events`)
  }

  console.log('Database seeding completed successfully!')
  await prisma.$disconnect()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })