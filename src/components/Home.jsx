import { useTranslation } from 'react-i18next';

function Home() {
  const { t } = useTranslation();

  return (
    <div className='pt-3 mb-10 font-thin'>
      <p>{t('description')}</p>
      <a className='underline text-blue-500' href="https://github.com/HenrikSantos/overlay-manager/releases">
        {t('download')}
      </a>
      <h2 className='mt-10 font-bold text-2xl'>{t('sections.title')}</h2>
      <ul className='pl-3'>
        <li>- {t('sections.create')}</li>
        <li>- {t('sections.edit')}</li>
        <li>- {t('sections.remove')}</li>
        <li>- {t('sections.toggle')}</li>
        <li>- {t('sections.language')}</li>
        <li>- {t('sections.transparency')}</li>
      </ul>
      <img className='mt-10' src="./public/usage.png" alt="usage example" />
    </div>
  );
}

export default Home;
