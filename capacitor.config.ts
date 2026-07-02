const config = {
  appId: 'app.fintrack.mobile',
  appName: 'MindLedger',
  webDir: '.next',
  server: {
    androidScheme: 'https',
    url: 'http://192.168.1.100:3000',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: true,
      spinnerColor: '#000000',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
