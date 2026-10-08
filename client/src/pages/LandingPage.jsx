import LandingNav from '../components/landing/LandingNav';
import Hero from '../components/landing/Hero';
import HowItWorks from '../components/landing/HowItWorks';
import CampusMapSection from '../components/landing/CampusMapSection';
import Bento from '../components/landing/Bento';
import SafetySection from '../components/landing/SafetySection';
import WhySection from '../components/landing/WhySection';
import ClubLeadersSection from '../components/landing/ClubLeadersSection';
import FAQSection from '../components/landing/FAQSection';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';
import StickyCTA from '../components/landing/StickyCTA';
import '../styles/landing.css';

export default function LandingPage() {
  return (
    <div className="landing-root min-h-screen">
      <LandingNav />
      <main>
        <Hero />
        <CampusMapSection />
        <HowItWorks />
        <Bento />
        <WhySection />
        <ClubLeadersSection />
        <SafetySection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
      <StickyCTA />
    </div>
  );
}
