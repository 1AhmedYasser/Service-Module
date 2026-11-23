import { InfoCardCopyRow, InfoCardSection } from 'components/InfoCard';
import i18n from 'i18n';
import { Service } from 'types';

import { ReactComponent as ReferencedServicesIcon } from '../../static/icons/referenced_services.svg';
import { ReactComponent as ReferencingServicesIcon } from '../../static/icons/referencing_services.svg';

export const ServiceInfoContent = ({ service }: { service: Service }) => (
  <>
    <InfoCardSection label={i18n.t('overview.serviceInfo.name')}>
      <InfoCardCopyRow value={service.name} />
    </InfoCardSection>
    <InfoCardSection label={i18n.t('overview.serviceInfo.description')}>
      <InfoCardCopyRow value={service.description ?? ''} />
    </InfoCardSection>
    <InfoCardSection label={i18n.t('overview.serviceInfo.examples')}>
      {service.examples?.length ? (
        service.examples.map((example, index) => <InfoCardCopyRow key={`${index}-${example}`} value={example} />)
      ) : (
        <InfoCardCopyRow value="" />
      )}
    </InfoCardSection>
    <InfoCardSection label={i18n.t('overview.serviceInfo.keywords')}>
      <InfoCardCopyRow value={service.entities?.join(', ') ?? ''} />
    </InfoCardSection>
  </>
);

export const DependenciesLegendContent = () => (
  <InfoCardSection>
    <p className="dependencies-legend__subtitle">{i18n.t('overview.dependencies.subtitle')}</p>
    <div className="dependencies-legend__row">
      <ReferencingServicesIcon className="dependencies-legend__icon" aria-hidden />
      <span>
        <strong className="dependencies-legend__incoming">{i18n.t('overview.dependencies.incomingLabel')}</strong>
        {' – '}
        {i18n.t('overview.dependencies.incomingDescription')}
      </span>
    </div>
    <div className="dependencies-legend__row">
      <ReferencedServicesIcon className="dependencies-legend__icon" aria-hidden />
      <span>
        <strong className="dependencies-legend__outgoing">{i18n.t('overview.dependencies.outgoingLabel')}</strong>
        {' – '}
        {i18n.t('overview.dependencies.outgoingDescription')}
      </span>
    </div>
  </InfoCardSection>
);
