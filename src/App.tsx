import { AuthProvider } from './app/AuthContext'
import { AppShell } from './app/Shell'
import { Card, ToastProvider } from './app/ui'
import { AgentDetailPage } from './app/pages/AgentDetail'
import { AgentsPage } from './app/pages/Agents'
import { AnalyticsPage } from './app/pages/Analytics'
import { AuthPage } from './app/pages/Auth'
import { AutomationsPage } from './app/pages/Automations'
import { BackupsPage } from './app/pages/Backups'
import { ConnectedAccountsPage } from './app/pages/ConnectedAccounts'
import { DatabasePage } from './app/pages/Database'
import { DocumentsPage } from './app/pages/Documents'
import { VoicePage } from './app/pages/Voice'
import { ConversationsPage } from './app/pages/Conversations'
import { IntegrationsPage } from './app/pages/Integrations'
import { KnowledgePage } from './app/pages/Knowledge'
import { OverviewPage } from './app/pages/Overview'
import { ProvidersPage } from './app/pages/Providers'
import { PublicAgentPage } from './app/pages/PublicAgent'
import { AdminPage } from './app/pages/Admin'
import { SettingsPage } from './app/pages/Settings'
import { TasksPage } from './app/pages/Tasks'
import { TemplatesPage } from './app/pages/Templates'
import { WizardPage } from './app/pages/Wizard'
import { Categories } from './sections/Categories'
import { Cta } from './sections/Cta'
import { Faq } from './sections/Faq'
import { Features } from './sections/Features'
import { Footer } from './sections/Footer'
import { Hero } from './sections/Hero'
import { Metrics } from './sections/Metrics'
import { Nav } from './sections/Nav'
import { Pricing } from './sections/Pricing'
import { Steps } from './sections/Steps'
import { Tools } from './sections/Tools'
import { UseCases } from './sections/UseCases'
import { navigate, useNavigation } from './lib/router'
import { Button } from './components/Button'

function Landing() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Metrics />
        <Categories />
        <Features />
        <Steps />
        <Tools />
        <UseCases />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  )
}

function StudioRoutes() {
  const { pathname } = useNavigation()
  const segments = pathname.split('/').filter(Boolean)

  if (segments[1] === 'agents' && segments[2] === 'new') return <WizardPage />
  if (segments[1] === 'agents' && segments[2]) return <AgentDetailPage />
  if (segments[1] === 'agents') return <AgentsPage />
  if (segments[1] === 'templates') return <TemplatesPage />
  if (segments[1] === 'knowledge') return <KnowledgePage />
  if (segments[1] === 'integrations') return <IntegrationsPage />
  if (segments[1] === 'providers') return <ProvidersPage />
  if (segments[1] === 'admin') return <AdminPage />
  if (segments[1] === 'documents') return <DocumentsPage />
  if (segments[1] === 'settings' && segments[2] === 'accounts') return <ConnectedAccountsPage />
  if (segments[1] === 'settings' && segments[2] === 'database') return <DatabasePage />
  if (segments[1] === 'settings' && segments[2] === 'backups') return <BackupsPage />
  if (segments[1] === 'settings' && segments[2] === 'voice') return <VoicePage />
  if (segments[1] === 'automations') return <AutomationsPage />
  if (segments[1] === 'conversations') return <ConversationsPage />
  if (segments[1] === 'tasks') return <TasksPage />
  if (segments[1] === 'analytics') return <AnalyticsPage />
  if (segments[1] === 'settings') return <SettingsPage />
  if (!segments[1]) return <OverviewPage />

  return (
    <Card className="p-8 text-center">
      <p className="text-[15px] font-medium">That page does not exist</p>
      <p className="mt-1 text-[12.5px] text-muted">Check the address or head back to your overview.</p>
      <Button className="mt-4" onClick={() => navigate('/app')}>
        Back to overview
      </Button>
    </Card>
  )
}

export function App() {
  const { pathname } = useNavigation()

  return (
    <AuthProvider>
      <ToastProvider>
        {pathname.startsWith('/share/') || pathname.startsWith('/embed/') ? (
          <PublicAgentPage embedded={pathname.startsWith('/embed/')} />
        ) : pathname === '/login' ? (
          <AuthPage mode="login" />
        ) : pathname === '/signup' ? (
          <AuthPage mode="signup" />
        ) : pathname.startsWith('/app') ? (
          <AppShell>
            <StudioRoutes />
          </AppShell>
        ) : (
          <Landing />
        )}
      </ToastProvider>
    </AuthProvider>
  )
}
