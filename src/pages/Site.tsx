import { useState } from 'react';
import { Nav } from '../components/Nav';
import { Hero } from '../sections/Hero';
import { Marquee } from '../sections/Marquee';
import { Catalog } from '../sections/Catalog';
import { FeedStrip } from '../sections/FeedStrip';
import { Process } from '../sections/Process';
import { Founders } from '../sections/Founders';
import { LeadMagnet } from '../sections/LeadMagnet';
import { Reviews } from '../sections/Reviews';
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
      <Catalog onOpenQuiz={open} />
      <FeedStrip />
      <Process onOpenQuiz={open} />
      <Founders />
      <LeadMagnet onOpenQuiz={open} />
      <Reviews />
      <Faq />
      <Footer />
      <FloatingDock />
      <QuizModal open={quizOpen} onClose={close} />
    </>
  );
};
