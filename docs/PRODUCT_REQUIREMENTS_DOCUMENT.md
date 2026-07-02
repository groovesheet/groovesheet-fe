# GrooveSheet Product Requirements Document (PRD)

## 2026-04-26 Update — Account Page / Billing & Usage

A dedicated signed-in account page is now a recommended product requirement.

Intent:
- give users a clear post-login control center
- make remaining minutes visible immediately
- support recharge / upgrade flows
- provide basic profile and security management

Recommended core modules:
- account header with profile image, display name, email, and current plan
- minutes balance card with renewal/expiry context
- recharge / top-up actions
- plan management / subscription management
- recent usage summary
- profile settings
- security actions such as password reset/change
- lightweight preferences and support links

Recommended route:
- `/account`

Primary source PRD for this feature:
- `TASK390_groovesheet_account_page_PRD.md`


**Version:** 1.0  
**Last Updated:** November 18, 2025  
**Product Name:** GrooveSheet (formerly DrumScore)  
**Product Type:** AI-Powered Drum Transcription SaaS Platform

---

## Executive Summary

### Product Vision
GrooveSheet is an AI-powered drum transcription platform that transforms audio recordings into professional drum notation in seconds. The platform eliminates the manual, time-consuming process of transcribing drum parts by leveraging advanced machine learning (AnNOTEator) and audio source separation (Demucs) technologies, enabling musicians, educators, and producers to focus on creativity rather than tedious transcription work.

### Target Market
- **Primary Users**: Professional drummers, drum instructors, music students
- **Secondary Users**: Music producers, band members, transcription services, music schools
- **Market Size**: Global music education and production market with specific focus on percussion-focused workflows

### Core Value Proposition
"Get professional drum sheet music in seconds, not weeks" - GrooveSheet automates the entire transcription pipeline from audio upload to exportable notation, reducing a multi-hour manual process to under 60 seconds of automated processing.

---

## Product Goals & Success Metrics

### Business Objectives
1. **User Acquisition**: Achieve 10,000+ registered users within first 6 months
2. **Conversion Rate**: Convert 15% of free users to paid subscriptions
3. **Retention**: Maintain 80%+ monthly active user retention
4. **Revenue**: Generate sustainable recurring revenue through tiered subscription model

### Key Performance Indicators (KPIs)
- **Processing Success Rate**: >95% successful transcriptions
- **Average Processing Time**: <60 seconds per track (up to 100MB)
- **User Satisfaction Score**: >4.5/5 stars
- **Monthly Processing Volume**: Track total minutes processed per month
- **API Uptime**: 99.5% availability
- **Export Completion Rate**: >90% of processed files downloaded

### User Success Metrics
- **Time to First Transcription**: <2 minutes from landing page
- **Transcription Accuracy**: User-reported accuracy >85%
- **Feature Adoption**: >60% users customize at least one setting
- **Export Format Usage**: Track PDF, MusicXML, MIDI export preferences

---

## User Personas

### Persona 1: Professional Drummer - "Marcus the Performer"
- **Age**: 28-45
- **Role**: Touring drummer, session musician
- **Goals**: Quickly document parts for rehearsals, archive performance ideas
- **Pain Points**: No time for manual transcription, needs accurate notation fast
- **Technical Proficiency**: Moderate (comfortable with DAWs and music software)
- **Usage Frequency**: 10-20 tracks per month
- **Preferred Features**: Fast processing, MIDI export, tempo detection

### Persona 2: Drum Instructor - "Sarah the Educator"
- **Age**: 30-55
- **Role**: Private drum instructor, music school teacher
- **Goals**: Create lesson materials, analyze student performances
- **Pain Points**: Expensive transcription services, time-consuming manual notation
- **Technical Proficiency**: Moderate to High (uses notation software regularly)
- **Usage Frequency**: 30-50 tracks per month
- **Preferred Features**: PDF export for printing, MusicXML for editing, bulk processing

### Persona 3: Hobbyist Musician - "Alex the Learner"
- **Age**: 16-35
- **Role**: Self-taught drummer, bedroom producer
- **Goals**: Learn favorite songs, improve drumming skills
- **Pain Points**: Can't afford expensive software, limited music reading ability
- **Technical Proficiency**: Low to Moderate (basic computer skills)
- **Usage Frequency**: 5-10 tracks per month
- **Preferred Features**: Free tier, simple interface, visual preview

---

## Functional Requirements

### 1. User Authentication & Account Management

#### 1.1 User Registration & Login
- **FR-1.1.1**: System shall support email/password registration
- **FR-1.1.2**: System shall support Single Sign-On (SSO) authentication via Google, Microsoft
- **FR-1.1.3**: System shall provide OAuth callback handling for SSO providers
- **FR-1.1.4**: System shall implement password reset functionality via email
- **FR-1.1.5**: System shall maintain user session state across page refreshes

#### 1.2 User Profiles
- **FR-1.2.1**: Users shall have access to account dashboard showing usage statistics
- **FR-1.2.2**: Users shall view remaining minutes in current subscription plan
- **FR-1.2.3**: Users shall access transcription history with search/filter capabilities
- **FR-1.2.4**: Users shall manage billing information and subscription settings

#### 1.3 Authorization
- **FR-1.3.1**: System shall enforce feature access based on subscription tier
- **FR-1.3.2**: Unauthenticated users shall receive login prompt when attempting upload
- **FR-1.3.3**: System shall track and enforce monthly minute quotas per user

---

### 2. Audio File Upload & Management

#### 2.1 File Upload Interface
- **FR-2.1.1**: Users shall upload audio files via drag-and-drop interface
- **FR-2.1.2**: Users shall upload audio files via file browser selection
- **FR-2.1.3**: System shall support MP3 and WAV file formats only
- **FR-2.1.4**: System shall enforce maximum file size of 100MB per upload
- **FR-2.1.5**: System shall validate file type and size before processing
- **FR-2.1.6**: System shall display clear error messages for invalid uploads

#### 2.2 Upload Experience
- **FR-2.2.1**: Upload area shall provide visual feedback during drag operations
- **FR-2.2.2**: System shall automatically initiate processing upon file selection
- **FR-2.2.3**: System shall display real-time upload progress indicator
- **FR-2.2.4**: Upload area shall change state to indicate dragging, uploading, and completion
- **FR-2.2.5**: System shall trigger celebratory confetti animation upon successful completion

#### 2.3 File Storage
- **FR-2.3.1**: System shall store uploaded files in Cloudflare R2 (S3-compatible object storage)
- **FR-2.3.2**: Files shall be organized by workflow ID in the `groovesheet-audio` bucket: `uploads/{workflow_id}_input.mp3`
- **FR-2.3.3**: System shall support local filesystem storage for development/testing
- **FR-2.3.4**: System shall retain uploaded files for minimum 30 days

---

### 3. Audio Processing & Transcription

#### 3.1 Processing Pipeline
- **FR-3.1.1**: System shall process audio through Demucs source separation to isolate drums
- **FR-3.1.2**: System shall detect tempo (BPM) automatically from audio
- **FR-3.1.3**: System shall detect time signatures automatically
- **FR-3.1.4**: System shall identify drum events using AnNOTEator ML model
- **FR-3.1.5**: System shall map detected events to standard drum notation
- **FR-3.1.6**: System shall generate MusicXML output from detected events

#### 3.2 Processing Status & Feedback
- **FR-3.2.1**: System shall provide real-time progress updates at key milestones:
  - 30%: Processing started
  - 35%: Demucs separation started
  - 55%: Demucs separation completed
  - 65%: Audio preprocessing completed
  - 80%: ML prediction completed
  - 90%: Sheet music generation started
  - 95%: MusicXML saved
  - 97%: Percussion notation fixed
  - 100%: Complete
- **FR-3.2.2**: Progress indicator shall display as animated gradient bar
- **FR-3.2.3**: System shall display estimated time remaining during processing
- **FR-3.2.4**: System shall handle and report processing errors gracefully

#### 3.3 Processing Architecture
- **FR-3.3.1**: API service shall publish jobs to a Redis Stream queue (`<service>-jobs`, e.g. `demucs-jobs`)
- **FR-3.3.2**: Worker service shall consume jobs from the stream via a consumer group (`XREADGROUP`)
- **FR-3.3.3**: Worker service shall run with minimum 1 replica always-on for responsiveness
- **FR-3.3.4**: System shall update job metadata (progress, status) in real-time
- **FR-3.3.5**: Processing shall complete within 60 seconds for typical tracks (3-5 minutes audio)

#### 3.4 Quality & Accuracy
- **FR-3.4.1**: System shall achieve >85% transcription accuracy (user-reported)
- **FR-3.4.2**: System shall correctly detect ghost notes with adjustable sensitivity
- **FR-3.4.3**: System shall properly map drum kit pieces to notation (kick, snare, hi-hat, etc.)
- **FR-3.4.4**: System shall handle tempo changes and complex time signatures

---

### 4. Customization & Editing

#### 4.1 Tempo Mapping
- **FR-4.1.1**: Users shall adjust detected BPM manually
- **FR-4.1.2**: Users shall modify tempo map for songs with tempo changes
- **FR-4.1.3**: System shall validate tempo values (30-300 BPM range)

#### 4.2 Notation Customization
- **FR-4.2.1**: Users shall adjust barlines and measure grouping
- **FR-4.2.2**: Users shall customize drum kit mapping (which drums appear on which staff lines)
- **FR-4.2.3**: Users shall adjust ghost-note sensitivity threshold
- **FR-4.2.4**: Users shall preview changes in real-time editor

#### 4.3 Live Preview
- **FR-4.3.1**: System shall render notation preview in-browser
- **FR-4.3.2**: Preview shall update immediately when customization changes are applied
- **FR-4.3.3**: Users shall zoom and pan notation preview
- **FR-4.3.4**: Preview shall display measures, barlines, and all notation symbols clearly

---

### 5. Export & Download

#### 5.1 Export Formats
- **FR-5.1.1**: Users shall export notation as PDF for printing and sharing
- **FR-5.1.2**: Users shall export as MusicXML for import into notation software (Sibelius, Finale, MuseScore)
- **FR-5.1.3**: Users shall export as MIDI for use in DAWs and sequencers
- **FR-5.1.4**: System shall generate high-quality, print-ready PDF output

#### 5.2 Download Experience
- **FR-5.2.1**: Download button shall appear upon processing completion
- **FR-5.2.2**: System shall generate unique download URLs with expiration
- **FR-5.2.3**: Downloads shall include descriptive filenames (original-name_notation.pdf)
- **FR-5.2.4**: System shall track download completion for analytics

---

### 6. Transcription History

#### 6.1 History Interface
- **FR-6.1.1**: Users shall access dedicated Transcription History page
- **FR-6.1.2**: History shall display all past transcriptions with metadata:
  - Original filename
  - Upload date/time
  - Processing duration
  - File size
  - Status (queued, processing, completed, failed)
- **FR-6.1.3**: Transcriptions shall be grouped by year (2025, 2024, etc.)
- **FR-6.1.4**: Users shall search history by filename

#### 6.2 History Actions
- **FR-6.2.1**: Users shall re-download previous transcriptions
- **FR-6.2.2**: Users shall delete transcriptions from history
- **FR-6.2.3**: Users shall sort by date, filename, or status
- **FR-6.2.4**: System shall paginate history for large datasets

---

### 7. Subscription & Billing

#### 7.1 Subscription Tiers
- **FR-7.1.1**: System shall offer Free tier with 10 minutes/month
  - Free result previews
  - 100MB upload limit per file
  - Standard processing queue
- **FR-7.1.2**: System shall offer Lite tier at $7.50/month (billed annually)
  - 60 minutes/month
  - Priority processing queue
  - Advanced customization features
  - All export formats
- **FR-7.1.3**: System shall offer Pro tier at $15/month (billed annually)
  - 150 minutes/month
  - Highest priority processing
  - Bulk upload support
  - API access
  - Premium support
- **FR-7.1.4**: System shall offer Enterprise tier (custom pricing)
  - Unlimited minutes
  - Dedicated processing infrastructure
  - Custom integrations
  - SLA guarantees

#### 7.2 Billing Cycles
- **FR-7.2.1**: Users shall choose between monthly and annual billing
- **FR-7.2.2**: Annual billing shall offer "3 months free" discount (25% off)
- **FR-7.2.3**: System shall clearly display savings for annual plans

#### 7.3 Top-Up Packs
- **FR-7.3.1**: Users shall purchase additional minutes as one-time top-ups
- **FR-7.3.2**: Top-up minutes shall expire 12 months from purchase date
- **FR-7.3.3**: System shall display expiration dates clearly in account dashboard

#### 7.4 Payment Processing
- **FR-7.4.1**: System shall integrate with secure payment processor (Stripe)
- **FR-7.4.2**: Users shall manage payment methods in account settings
- **FR-7.4.3**: System shall send email receipts for all transactions
- **FR-7.4.4**: Users shall view billing history and invoices

#### 7.5 Minute Tracking
- **FR-7.5.1**: System shall deduct minutes based on audio duration, not file size
- **FR-7.5.2**: System shall display remaining minutes prominently in UI
- **FR-7.5.3**: System shall warn users when approaching minute limit
- **FR-7.5.4**: System shall prevent processing when minutes are exhausted
- **FR-7.5.5**: Minutes shall roll over monthly for subscription plans

---

### 8. Marketing Pages

#### 8.1 Landing Page (Hero Section)
- **FR-8.1.1**: Hero section shall communicate core value proposition immediately
- **FR-8.1.2**: Hero shall include prominent upload interface for immediate engagement
- **FR-8.1.3**: Hero shall display sample audio waveform or demo
- **FR-8.1.4**: Hero background shall feature branded visual imagery

#### 8.2 Features Section
- **FR-8.2.1**: Features section shall highlight 3 primary benefits:
  - Upload Your Track (ease of use)
  - Customize Instantly (control and flexibility)
  - Export (professional output)
- **FR-8.2.2**: Each feature shall include icon, title, and description
- **FR-8.2.3**: Features shall use visual metaphors (arrows, hands, checkmarks)

#### 8.3 Pricing Section
- **FR-8.3.1**: Pricing section shall display all subscription tiers side-by-side
- **FR-8.3.2**: Most popular plan shall be visually highlighted
- **FR-8.3.3**: Each plan shall list all included features with checkmarks
- **FR-8.3.4**: Pricing section shall include toggle for monthly/annual billing
- **FR-8.3.5**: Tab system shall allow switching between Plans and Top-Ups views

#### 8.4 Testimonials Section
- **FR-8.4.1**: Testimonials shall display user feedback with names and roles
- **FR-8.4.2**: Testimonials shall be visually distinct from other content
- **FR-8.4.3**: Section shall build social proof and credibility

#### 8.5 Plan Comparison Section
- **FR-8.5.1**: Detailed feature comparison table shall show all tier differences
- **FR-8.5.2**: Comparison shall clearly indicate which features are included per tier
- **FR-8.5.3**: Users shall easily compare value propositions

#### 8.6 FAQ Section
- **FR-8.6.1**: FAQ shall address common questions grouped by category:
  - Overview (signup, track splitting)
  - Packs and Minutes (expiration, deduction, rollover)
  - Technical (supported formats, processing time, accuracy)
  - Billing (payment methods, refunds, cancellation)
- **FR-8.6.2**: Questions shall be collapsible/expandable for better UX
- **FR-8.6.3**: FAQ shall reduce support burden by addressing 80%+ common queries

---

## Non-Functional Requirements

### 9. Performance

#### 9.1 Speed & Responsiveness
- **NFR-9.1.1**: Landing page shall load in <2 seconds on 4G connection
- **NFR-9.1.2**: UI interactions shall respond within 100ms
- **NFR-9.1.3**: File upload shall support resumable uploads for large files
- **NFR-9.1.4**: Processing shall complete in <60 seconds for 3-5 minute audio tracks
- **NFR-9.1.5**: API endpoints shall respond within 500ms (excluding processing jobs)

#### 9.2 Scalability
- **NFR-9.2.1**: System shall support 1,000+ concurrent users
- **NFR-9.2.2**: Processing queue shall handle 100+ simultaneous jobs
- **NFR-9.2.3**: Worker service shall auto-scale based on queue depth
- **NFR-9.2.4**: Database shall support 100,000+ user records without performance degradation

#### 9.3 Availability
- **NFR-9.3.1**: System shall maintain 99.5% uptime (excluding planned maintenance)
- **NFR-9.3.2**: Planned maintenance shall occur during low-traffic windows
- **NFR-9.3.3**: System shall implement health checks and auto-recovery
- **NFR-9.3.4**: Critical failures shall trigger alerts to engineering team within 2 minutes

---

### 10. Security & Privacy

#### 10.1 Authentication Security
- **NFR-10.1.1**: Passwords shall be hashed using bcrypt with salt
- **NFR-10.1.2**: System shall enforce password complexity requirements (8+ chars, mixed case, numbers)
- **NFR-10.1.3**: System shall implement rate limiting on login attempts (5 attempts per 15 minutes)
- **NFR-10.1.4**: SSO shall use industry-standard OAuth 2.0 / OIDC protocols
- **NFR-10.1.5**: Session tokens shall expire after 7 days of inactivity

#### 10.2 Data Protection
- **NFR-10.2.1**: All data transmission shall use HTTPS/TLS 1.3
- **NFR-10.2.2**: Audio files shall be encrypted at rest in cloud storage
- **NFR-10.2.3**: User data shall comply with GDPR and CCPA regulations
- **NFR-10.2.4**: Users shall have right to download or delete their data
- **NFR-10.2.5**: Payment information shall never be stored (handled by PCI-compliant processor)

#### 10.3 Access Control
- **NFR-10.3.1**: Users shall only access their own transcriptions
- **NFR-10.3.2**: Download URLs shall be signed with expiration (24-hour validity)
- **NFR-10.3.3**: API endpoints shall require valid authentication tokens
- **NFR-10.3.4**: Admin users shall have separate elevated access controls

---

### 11. Usability & Accessibility

#### 11.1 User Experience
- **NFR-11.1.1**: Interface shall be intuitive for users with basic computer skills
- **NFR-11.1.2**: First-time users shall complete their first transcription in <5 minutes
- **NFR-11.1.3**: Error messages shall be clear and actionable
- **NFR-11.1.4**: Success states shall provide clear visual feedback (checkmarks, confetti)

#### 11.2 Accessibility (WCAG 2.1 AA Compliance)
- **NFR-11.2.1**: All interactive elements shall be keyboard-navigable
- **NFR-11.2.2**: Color contrast shall meet WCAG AA standards (4.5:1 for normal text)
- **NFR-11.2.3**: Form inputs shall have proper labels and ARIA attributes
- **NFR-11.2.4**: Focus indicators shall be clearly visible
- **NFR-11.2.5**: Screen readers shall correctly announce all UI states

#### 11.3 Responsive Design
- **NFR-11.3.1**: UI shall be fully responsive across desktop, tablet, and mobile
- **NFR-11.3.2**: Mobile breakpoint: 640px, Tablet: 768px, Desktop: 769px+
- **NFR-11.3.3**: Touch targets shall be minimum 44x44px on mobile
- **NFR-11.3.4**: Mobile layout shall stack elements vertically for readability

---

### 12. Design System Compliance

#### 12.1 Visual Design
- **NFR-12.1.1**: All UI shall use 'Hubot Sans' font family
- **NFR-12.1.2**: Color palette shall follow defined brand colors:
  - Background: #171717
  - Primary Blue: #012FA7
  - White: #FFFFFF
  - Card backgrounds: #323033
  - Error: #FF6B6B
  - Success: #22C55E
- **NFR-12.1.3**: Spacing shall use 4px-based grid system
- **NFR-12.1.4**: Border radius shall be 6px (buttons), 12px (cards), 120px (pills)

#### 12.2 Component Consistency
- **NFR-12.2.1**: Buttons shall use standard sizes and hover states
- **NFR-12.2.2**: Cards shall maintain consistent padding and shadows
- **NFR-12.2.3**: Typography scale shall follow design system (12px-76.8px)
- **NFR-12.2.4**: Animations shall use 0.2s-0.3s duration with ease timing

#### 12.3 Iconography
- **NFR-12.3.1**: System shall use Phosphor Icons library consistently
- **NFR-12.3.2**: Icon sizes: 14px (buttons), larger for features/decorative
- **NFR-12.3.3**: Icons shall inherit color from parent or use explicit values

---

### 13. Technical Architecture

#### 13.1 Frontend Stack
- **NFR-13.1.1**: React 18+ for UI framework
- **NFR-13.1.2**: React Router for client-side routing
- **NFR-13.1.3**: Supabase for authentication management
- **NFR-13.1.4**: Vercel for hosting and deployment
- **NFR-13.1.5**: Canvas-confetti for celebration animations

#### 13.2 Backend Stack
- **NFR-13.2.1**: Python 3.8 (TensorFlow 2.10.0 compatibility requirement)
- **NFR-13.2.2**: FastAPI for API service
- **NFR-13.2.3**: TensorFlow 2.10.0 for ML inference
- **NFR-13.2.4**: Demucs for audio source separation
- **NFR-13.2.5**: Librosa 0.9.0+ for audio processing
- **NFR-13.2.6**: k3s (hybrid Hetzner control plane + NUS GPU node) for container orchestration
- **NFR-13.2.7**: Cloudflare R2 for file storage
- **NFR-13.2.8**: Redis Streams (in-cluster) for job queue
- **NFR-13.2.9**: Neon Postgres for application database

#### 13.3 ML Models
- **NFR-13.3.1**: AnNOTEator complete_network.h5 model for drum detection
- **NFR-13.3.2**: Model files shall be version-controlled and deployed with worker
- **NFR-13.3.3**: Model inference shall support batch processing for efficiency

#### 13.4 Development Environment
- **NFR-13.4.1**: Docker Compose for local development
- **NFR-13.4.2**: Separate configurations for local vs. cluster deployment
- **NFR-13.4.3**: Environment variables for configuration management
- **NFR-13.4.4**: Automated deployment scripts for rapid iteration

---

### 14. Monitoring & Analytics

#### 14.1 Application Monitoring
- **NFR-14.1.1**: System shall log all errors with stack traces
- **NFR-14.1.2**: Performance metrics shall be tracked per endpoint
- **NFR-14.1.3**: Processing pipeline steps shall emit timing metrics
- **NFR-14.1.4**: Worker pods shall report health status (k8s liveness/readiness probes)

#### 14.2 User Analytics
- **NFR-14.2.1**: System shall track user acquisition funnel
- **NFR-14.2.2**: System shall measure feature usage (exports by format, customizations)
- **NFR-14.2.3**: System shall calculate conversion rates per tier
- **NFR-14.2.4**: System shall monitor minute consumption patterns

#### 14.3 Business Metrics
- **NFR-14.3.1**: Dashboard shall display MRR (Monthly Recurring Revenue)
- **NFR-14.3.2**: Dashboard shall show churn rate and retention cohorts
- **NFR-14.3.3**: Dashboard shall track processing volume trends
- **NFR-14.3.4**: Support ticket volume and resolution time shall be monitored

---

## User Workflows

### Workflow 1: First-Time User Transcription

1. **Landing** → User arrives at GrooveSheet homepage
2. **Browse** → User explores features, pricing, testimonials
3. **Upload Decision** → User decides to try service
4. **Login Prompt** → System prompts for authentication when upload attempted
5. **Sign Up** → User creates account via email or SSO
6. **File Selection** → User drags MP3 file or clicks "Browse Files"
7. **Upload** → File uploads with progress indicator
8. **Processing** → Real-time progress updates (30% → 100%)
9. **Completion** → Confetti animation, download button appears
10. **Download** → User downloads MusicXML/PDF
11. **Success** → User has completed first transcription in <5 minutes

### Workflow 2: Returning User with Customization

1. **Login** → User signs in to account
2. **History Access** → User navigates to Transcription History
3. **New Upload** → User uploads new track from history page or hero section
4. **Auto-Processing** → Processing begins automatically
5. **Preview** → User views initial transcription in live preview
6. **Customize** → User adjusts BPM, ghost note sensitivity, kit mapping
7. **Real-Time Update** → Preview updates immediately with changes
8. **Refine** → User iterates on customization until satisfied
9. **Export** → User exports as MusicXML for notation software
10. **Import** → User opens in Sibelius/MuseScore for final edits

### Workflow 3: Subscription Upgrade

1. **Usage Limit** → User exhausts free tier minutes
2. **Limit Warning** → System displays "X minutes remaining" message
3. **Pricing Page** → User navigates to pricing section
4. **Plan Comparison** → User reviews Lite vs Pro features
5. **Selection** → User selects Lite plan with annual billing
6. **Checkout** → Stripe payment form appears
7. **Payment** → User enters payment information
8. **Confirmation** → Email receipt sent, account updated
9. **Immediate Access** → New minute quota available instantly
10. **Continued Use** → User uploads more tracks with priority processing

---

## Out of Scope (Future Enhancements)

The following features are explicitly **not included** in the current version but may be considered for future releases:

### Phase 2 Features
- **Multi-track Support**: Process multiple instruments (bass, guitar, vocals)
- **Collaboration**: Share transcriptions with team members
- **Mobile Apps**: Native iOS/Android applications
- **Real-Time Editing**: In-browser notation editor with full editing capabilities
- **Audio Playback Sync**: Play audio alongside notation with highlighted playback position
- **Custom Drum Kits**: User-defined kit piece mappings
- **Batch Processing**: Upload multiple files simultaneously

### Phase 3 Features
- **API for Developers**: Public API for third-party integrations
- **Tablature Export**: Guitar/bass tablature generation
- **Stem Separation**: Export separated drum stems as individual audio files
- **Chord Detection**: Harmonic analysis and chord symbol generation
- **Practice Tools**: Slow-down playback, loop sections, metronome
- **Community Library**: Share and discover transcriptions
- **White-Label Solution**: Enterprise custom branding

---

## Technical Constraints & Dependencies

### Critical Dependencies
1. **TensorFlow 2.10.0**: Required for AnNOTEator model compatibility
2. **Python 3.8**: Required for TensorFlow 2.10.0
3. **Protobuf 3.9.2**: Compatibility constraint with TensorFlow
4. **Librosa 0.9.0+**: Audio processing library (requires keyword arguments)
5. **Demucs**: Source separation model (must limit workers to 1 to prevent worker hanging)

### Infrastructure Requirements
1. **k3s cluster (hybrid)**: Hetzner `gs-master` for the control plane + orchestrator; NUS `clear-crystal` GPU node for ML inference workers
2. **Worker Configuration**: 
   - Worker min-replicas=1 (always-on for responsiveness)
   - GPU workers scheduled on the tainted NUS node
   - Adequate memory allocation (4GB+ for ML models)
3. **Object storage**: Cloudflare R2 bucket `groovesheet-audio` for file storage
4. **Job queue**: In-cluster Redis Streams — `<service>-jobs` streams and a `job-events` completion stream

### Browser Compatibility
- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions
- **Mobile Safari**: iOS 13+
- **Chrome Mobile**: Android 8+

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| ML model accuracy below expectations | Medium | High | Implement feedback loop for model retraining; provide manual editing tools |
| Processing time exceeds 60s target | Medium | Medium | Optimize Demucs worker configuration; implement queue priority system |
| Worker pod cold starts impact UX | Low | Medium | Maintain min-replicas=1 for worker deployments |
| Dependency conflicts break deployment | Low | High | Lock all dependency versions; comprehensive CI/CD testing |
| Storage costs exceed projections | Medium | Medium | Implement automatic file cleanup after 30 days; compress uploads |

### Business Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Low conversion from free to paid | Medium | High | Optimize onboarding; implement usage nudges; A/B test pricing |
| High churn rate | Medium | High | Improve transcription quality; add value through features; customer success outreach |
| Market competition from established notation software | High | Medium | Focus on speed and automation as differentiators; build integrations |
| Copyright concerns with user uploads | Low | High | Clear ToS; implement content policy; respond to DMCA requests |
| Insufficient user acquisition | Medium | High | Content marketing; partnerships with music schools; influencer outreach |

---

## Success Criteria

### Launch Readiness Checklist

#### Core Functionality
- [ ] User authentication (email + SSO) working
- [ ] File upload supports MP3 and WAV up to 100MB
- [ ] Processing pipeline completes successfully for test tracks
- [ ] All three export formats (PDF, MusicXML, MIDI) generate correctly
- [ ] Transcription history displays and search works
- [ ] Subscription tiers enforced with minute tracking

#### User Experience
- [ ] Landing page loads in <2 seconds
- [ ] Processing provides real-time progress updates
- [ ] Error states handled gracefully with clear messages
- [ ] Mobile responsive design works across devices
- [ ] Design system consistently applied across all components

#### Business Operations
- [ ] Payment processing integrated and tested
- [ ] Email notifications configured (receipts, password resets)
- [ ] Analytics tracking implemented
- [ ] Monitoring and alerting configured
- [ ] Customer support system in place

#### Quality Assurance
- [ ] Security audit completed
- [ ] Load testing validates 1,000 concurrent users
- [ ] Accessibility audit passes WCAG AA
- [ ] Browser compatibility verified across major browsers
- [ ] Legal review of ToS and Privacy Policy completed

---

## Appendix

### A. Design System Reference
Full design system specifications available in: `DESIGN_SYSTEM.md`

### B. API Endpoints

**Authentication**
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/sso-callback` - SSO OAuth callback
- `POST /auth/logout` - User logout

**Transcription**
- `POST /api/v1/transcribe` - Upload and start transcription job
- `GET /api/v1/jobs/{job_id}` - Get job status and metadata
- `GET /api/v1/jobs/{job_id}/download` - Download transcription result
- `GET /api/v1/jobs` - List user's transcription history

**User Account**
- `GET /api/v1/user/profile` - Get user profile
- `GET /api/v1/user/usage` - Get minute usage statistics
- `PUT /api/v1/user/profile` - Update user profile

**Billing**
- `POST /api/v1/billing/subscribe` - Create subscription
- `PUT /api/v1/billing/subscription` - Update subscription
- `DELETE /api/v1/billing/subscription` - Cancel subscription
- `POST /api/v1/billing/top-up` - Purchase top-up pack
- `GET /api/v1/billing/invoices` - List billing history

### C. Environment Variables

**Frontend (groovesheet-fe)**
```
REACT_APP_NAME=GrooveSheet
REACT_APP_URL=https://groovesheet.com
REACT_APP_API_URL=/api
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_SUPABASE_URL=<supabase_url>
REACT_APP_SUPABASE_ANON_KEY=<supabase_anon_key>
```

**Backend API Service**
```
DATABASE_URL=<neon-postgres-connection-string>
STORAGE_BUCKET=groovesheet-audio
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
REDIS_URL=redis://redis.audio-workers.svc.cluster.local:6379
JOB_EVENTS_STREAM=job-events
PORT=8080
```

**Backend Worker Service**
```
STORAGE_BUCKET=groovesheet-audio
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
REDIS_URL=redis://redis.audio-workers.svc.cluster.local:6379
STREAM_NAME=demucs-jobs
GROUP_NAME=demucs-worker-group
DEMUCS_NUM_WORKERS=1
PORT=8080
```

### D. Testing Scenarios

**Critical User Paths to Test**
1. First-time user signup → upload → download
2. SSO login flow
3. Free tier minute exhaustion → upgrade prompt
4. Annual subscription purchase
5. File upload error handling (wrong format, too large)
6. Processing failure → error message → retry
7. Mobile upload workflow
8. History search and re-download
9. Customization changes → preview update
10. Multi-format export (PDF, MusicXML, MIDI)

---

**Document Owner**: Product Management Team  
**Contributors**: Engineering, Design, Marketing  
**Approval Status**: Draft for Review  
**Next Review Date**: December 18, 2025

---

*This PRD is a living document and will be updated as requirements evolve and new information becomes available.*
