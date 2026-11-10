// google-services.json no va en el repo (es público). En EAS se inyecta como
// variable de entorno de tipo archivo GOOGLE_SERVICES_JSON; en local se usa la
// copia ignorada por git en la raíz.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
