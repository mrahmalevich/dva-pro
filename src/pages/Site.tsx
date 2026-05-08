import { useState } from 'react';
import { Nav } from '../components/Nav';
import { Hero } from '../sections/Hero';
import { Marquee } from '../sections/Marquee';
import { LeadMagnet } from '../sections/LeadMagnet';
import { Catalog } from '../sections/Catalog';
import { Process } from '../sections/Process';
import { Reviews } from '../sections/Reviews';
import { CtaShipFromAnywhere } from '../sections/CtaShipFromAnywhere';
import { Faq } from '../sections/Faq';
import { Footer, FloatingDock } from '../sections/Footer';
import { QuizModal } from '../quiz/QuizModal';

export const Site = () => {
  const [quizOpen, setQuizOpen] = useState(false);
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const open = () => setQuizOpen(true);
  const close = () => setQuizOpen(false);

  return (
    <>
      <Nav onOpenQuiz={open} lang={lang} setLang={setLang} />
      <Hero onOpenQuiz={open} />
      <Marquee />
      <LeadMagnet onOpenQuiz={open} />
      <Process onOpenQuiz={open} />
      <Catalog onOpenQuiz={open} />
      <Reviews />
      <CtaShipFromAnywhere onOpenQuiz={open} />
      <Faq />
      <Footer />
      <FloatingDock />
      <QuizModal open={quizOpen} onClose={close} />
    </>
  );
};
