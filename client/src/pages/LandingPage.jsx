import LandingNav from '../components/landing/LandingNav';
import Hero from '../components/landing/Hero';
import HowItWorks from '../components/landing/HowItWorks';
import CampusMapSection from '../components/landing/CampusMapSection';
import Bento from '../components/landing/Bento';
import SafetySection from '../components/landing/SafetySection';
import WhySection from '../components/landing/WhySection';
import ClubLeadersSection from '../components/landing/ClubLeadersSection';
import FAQSection from '../components/landing/FAQSection';
import PricingSection from '../components/landing/PricingSection';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';
import StickyCTA from '../components/landing/StickyCTA';
import MobileWelcome from '../components/landing/MobileWelcome';
import useMediaQuery from '../hooks/useMediaQuery';
import '../styles/landing.css';

// Telefonda ilk ekran uygulama açılışı gibi (MobileWelcome); tanıtım bölümleri
// altında kalır ve üst menü ancak o bölümlere inilince görünür.
export default function LandingPage() {
  const phone = useMediaQuery('(max-width: 767px)');
  return (
    <div className="landing-root min-h-screen">
      <LandingNav hideAtTop={phone} />
      <main>
        {phone ? <MobileWelcome tourId="tanitim" /> : <Hero />}
        <div id="tanitim" className="scroll-mt-20" />
        <CampusMapSection />
        <HowItWorks />
        <Bento />
        <WhySection />
        <ClubLeadersSection />
        <SafetySection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
      <StickyCTA />
    </div>
  );
}
