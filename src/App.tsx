import React, { useState } from 'react';
import { AuthModal } from './components/auth/AuthModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { LandingPage } from './components/landing/LandingPage';
import { StudentDashboard } from './components/student/StudentDashboard';
import { VendorDashboard } from './components/vendor/VendorDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';

function AppShell() {
  const { user, loading } = useAuth();
  const [viewMode, setViewMode] = useState<'landing' | 'workspace'>('landing');
  const [selectedStallId, setSelectedStallId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');

  const openAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
  };

  const handleExploreFood = (stallId?: string, category?: string) => {
    setSelectedStallId(stallId);
    setSelectedCategory(category);
    setViewMode('workspace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-xl font-extrabold tracking-tight text-[#0B132B] font-display">
            CampusBite
          </div>
          <p className="text-xs text-[#57534E]">Loading IIIT Allahabad campus workspace...</p>
        </div>
      </div>
    );
  }

  const renderMainView = () => {
    if (viewMode === 'landing') {
      return (
        <LandingPage
          onExploreFood={handleExploreFood}
          onOpenAuth={openAuth}
          currentUserRole={user?.role}
        />
      );
    }

    if (user?.role === 'vendor') {
      return <VendorDashboard onBackToLanding={() => setViewMode('landing')} />;
    }

    if (user?.role === 'admin') {
      return <AdminDashboard onBackToLanding={() => setViewMode('landing')} />;
    }

    return (
      <StudentDashboard
        initialStallId={selectedStallId}
        initialCategory={selectedCategory}
        onBackToLanding={() => setViewMode('landing')}
        onOpenAuth={() => openAuth('login')}
      />
    );
  };

  return (
    <>
      {renderMainView()}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setViewMode('workspace')}
      />
    </>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-6 shadow-sm space-y-3">
            <h1 className="text-lg font-bold text-[#0B132B]">
              Something went wrong rendering CampusBite
            </h1>
            <p className="text-sm text-[#57534E]">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <AppShell />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
