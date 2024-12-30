import { useTranslation } from 'react-i18next';

function Header() {
  const { i18n, t } = useTranslation();

  const toggleLanguage = () => {
    const newLanguage = i18n.language === 'en' ? 'pt' : 'en';
    i18n.changeLanguage(newLanguage);
  };

  return (
    <header className='flex justify-between'>
      <h1 className='font-bold text-4xl'>{t('title')}</h1>
      <button className='hover:underline' onClick={toggleLanguage}>
        {i18n.language === 'en' ? 'Português' : 'English'}
      </button>
    </header>
  );
}

export default Header;
