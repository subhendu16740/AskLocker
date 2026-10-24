// The intro: three slides, then the agreement (062), which nobody passes
// without ticking it: a sheet at the foot of the screen over the last slide,
// dimmed, the way the card after sign-in looks. Finish goes on to sign in; the tick waits on this
// device for the account that signs in (agreement-device.ts). The login
// screen sends anyone here, straight to the agreement (?step=agree), until
// this device has agreed to the current version; once it has, the slides
// lead straight to sign-in.

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgreementSheet } from '../components/agreement-screen';
import { agreeOnThisDevice, deviceAgreedToCurrent } from '../lib/agreement-device';

const { width } = Dimensions.get('window');

// One title and one line each (the owner's ask, 23 October 2026).
const slides = [
  {
    emoji: '🔐',
    title: 'Welcome to AskLocker',
    subtitle: "Your family's documents, in one place.",
  },
  {
    emoji: '📷',
    title: 'Snap or upload',
    subtitle: 'AskLocker reads every page for you.',
  },
  {
    emoji: '💬',
    title: 'Just ask',
    subtitle: '“When does Dad\'s passport expire?”',
  },
];

export default function OnboardingScreen() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  // Whether this device still has to agree: the last step only then.
  const [mustAgree, setMustAgree] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(step === 'agree' ? slides.length : 0);
  const [ticked, setTicked] = useState(false);

  useEffect(() => {
    deviceAgreedToCurrent().then((agreed) => setMustAgree(!agreed)).catch(() => {});
  }, []);

  const agreeing = mustAgree && currentSlide >= slides.length;

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else if (mustAgree) {
      setCurrentSlide(slides.length);
    } else {
      router.replace('/login');
    }
  };

  const finish = async () => {
    if (!ticked) return;
    await agreeOnThisDevice(true);
    router.replace('/login');
  };

  // Behind the agreement: the slide it came from (the first, from sign-in).
  const shown = Math.min(currentSlide, slides.length - 1);
  const slide = slides[shown];

  return (
    <LinearGradient
      colors={['#2A3D66', '#4A6491']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} aria-hidden={agreeing}>
        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.emoji}>{slide.emoji}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </View>

        {/* Bottom */}
        <View style={styles.bottom}>
          {/* Dots */}
          <View style={styles.dots}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === shown ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Button */}
          <TouchableOpacity onPress={handleNext} style={styles.button} activeOpacity={0.8} disabled={agreeing}>
            <Text style={styles.buttonText}>
              {currentSlide < slides.length - 1 ? 'Next' : 'Get started'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* The agreement: over the slide, which stays in sight, dimmed. */}
      {agreeing && (
        <View style={styles.dim}>
          <AgreementSheet ticked={ticked} onTick={setTicked} label="Finish" onPress={finish} />
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    maxWidth: 390,
    alignSelf: 'center',
    width: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(13, 17, 23, 0.45)' },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  bottom: {
    alignItems: 'center',
    marginBottom: 40,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 32,
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 40,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
