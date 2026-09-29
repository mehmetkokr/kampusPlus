import LandingNav from '../components/landing/LandingNav';
import Hero from '../components/landing/Hero';
import TrustStats from '../components/landing/TrustStats';
import HowItWorks from '../components/landing/HowItWorks';
import Features from '../components/landing/Features';
import SafetySection from '../components/landing/SafetySection';
import Testimonials from '../components/landing/Testimonials';
import FAQSection from '../components/landing/FAQSection';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink font-body text-paper">
      <LandingNav />
      <main>
        <Hero />
        <TrustStats />
        <HowItWorks />
        <Features />
        <SafetySection />
        <Testimonials />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
