import FormError from 'components/FormElements/FormError';
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdCheck, MdDeleteOutline, MdEdit } from 'react-icons/md';
import ReactQuill from 'react-quill-new';
import useServiceStore from 'store/new-services.store';
import useServiceListStore from 'store/services.store';
import { generateUniqueId, getMcqNodeId } from 'utils/flow-utils';
import { removeNestedTemplates, removeTrailingUnderscores } from 'utils/string-util';

import Button from '../Button';
import { FormInput, FormRichText } from '../FormElements';
import Icon from '../Icon';
import Track from '../Track';
import PreviousVariables from './PreviousVariables';

import './styles.scss';

const maxButtons = Number.parseInt((import.meta.env.REACT_APP_MULTI_CHOICE_QUESTION_MAX_BUTTONS as string) ?? '4');

export interface MultiChoiceQuestionContentProps {
  question: string;
  defaultQuestion?: string;
  buttons: { id: string; title: string; payload: string }[];
  setQuestion: (q: string) => void;
  setButtons: (b: { id: string; title: string; payload: string }[]) => void;
  setIsSaveEnabled: (b: boolean) => void;
}

const MultiChoiceQuestionContent: FC<MultiChoiceQuestionContentProps> = ({
  question,
  defaultQuestion,
  buttons,
  setQuestion,
  setButtons,
  setIsSaveEnabled,
}) => {
  const { t } = useTranslation();
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const node = useServiceStore((state) => state.selectedNode);
  const serviceName = useServiceStore((state) => removeTrailingUnderscores(state.serviceNameDashed()));
  const selectedService = useServiceListStore((state) => state.selectedService);
  const quillRef = useRef<ReactQuill>(null);

  const mcqNodeNumber = String(node ? getMcqNodeId(node.data) : 1);

  const handleQuestionChange = (value: string | null) => {
    const formattedValue = removeNestedTemplates(value ?? '');
    if (value !== formattedValue && quillRef.current) {
      const editor = quillRef.current.getEditor();
      editor.setText(formattedValue.replaceAll(/<\/?p>/g, '') || '');
    }
    setQuestion(formattedValue);
    setIsSaveEnabled(buttons.length > 1);
  };

  const handleEdit = (idx: number) => {
    setEditIndex(idx);
    setEditValue(buttons[idx].title);
  };

  const handleEditSave = (idx: number) => {
    const currentTitles = buttons.map((btn) => btn.title);
    if (currentTitles.includes(editValue) || editValue === '') {
      setEditIndex(null);
      setEditValue('');
      return;
    }
    const newButtons = [...buttons];
    newButtons[idx] = { ...newButtons[idx], title: editValue };
    setButtons(newButtons);
    setEditIndex(null);
    setEditValue('');
    setIsSaveEnabled(newButtons.length > 1 && newButtons.every((btn) => btn.title.length > 0));
  };

  const handleDelete = (idx: number) => {
    const newButtons = buttons.filter((_, i) => i !== idx);
    setButtons(newButtons);
    if (editIndex === idx) {
      setEditIndex(null);
      setEditValue('');
    }
    setIsSaveEnabled(newButtons.length > 1 && newButtons.every((btn) => btn.title.length > 0));
  };

  const handleAdd = () => {
    const newButtons = [
      ...buttons,
      {
        id: generateUniqueId(),
        title: '',
        payload: `#service, /${selectedService?.type ?? 'POST'}/services/active/${serviceName}_mcq_${mcqNodeNumber}_${buttons.length}`,
      },
    ];
    setButtons(newButtons);
    setIsSaveEnabled(false);
  };

  return (
    <Track direction="vertical" align="stretch">
      <Track
        direction="vertical"
        align="stretch"
        style={{ width: '100%', padding: 16, borderBottom: '1px solid #D2D3D8' }}
      >
        <label style={{ marginBottom: '10px' }}>{t('serviceFlow.popup.messageLabel')}</label>
        <FormRichText quill={quillRef} onChange={handleQuestionChange} defaultValue={defaultQuestion ?? question} />
        {!question.length && (
          <FormError style={{ marginTop: 2 }}>{t('serviceFlow.multiChoiceQuestion.questionError')}</FormError>
        )}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 500 }}>{t('serviceFlow.multiChoiceQuestion.userChoices')}</div>
          <Track direction="vertical" gap={8} style={{ marginTop: 8 }}>
            {buttons.map((btn, idx) => (
              <Track key={btn.id} gap={8} align="center" style={{ width: '100%' }}>
                {editIndex === idx ? (
                  <>
                    <FormInput
                      name={`button-title-${idx}`}
                      label=""
                      placeholder={t('serviceFlow.multiChoiceQuestion.ellipsis')}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave(idx);
                        if (e.key === 'Escape') setEditIndex(null);
                      }}
                      style={{ minWidth: 120, flex: 1 }}
                      hideLabel
                    />
                    <Button
                      appearance="icon"
                      size="s"
                      onClick={() => handleEditSave(idx)}
                      aria-label={t('global.save')}
                    >
                      <Icon icon={<MdCheck />} size="medium" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div style={{ minWidth: 120, flex: 1 }}>
                      <Button disabled className="multiple-choice-question-button">
                        <span className="multiple-choice-question-button__text">
                          {btn.title.length > 0 ? btn.title : t('serviceFlow.multiChoiceQuestion.ellipsis')}
                        </span>
                      </Button>
                    </div>
                    <Button
                      appearance="icon"
                      size="s"
                      onClick={() => handleEdit(idx)}
                      aria-label={t('serviceFlow.multiChoiceQuestion.edit')}
                    >
                      <Icon icon={<MdEdit />} size="medium" />
                    </Button>
                  </>
                )}
                <Button
                  appearance="icon"
                  size="s"
                  onClick={() => handleDelete(idx)}
                  aria-label={t('serviceFlow.multiChoiceQuestion.delete')}
                >
                  <Icon icon={<MdDeleteOutline />} size="medium" />
                </Button>
              </Track>
            ))}
          </Track>
          <Track gap={8} style={{ marginTop: 12 }}>
            <Button
              appearance="secondary"
              onClick={handleAdd}
              disabled={buttons.length >= maxButtons}
              aria-label={t('serviceFlow.multiChoiceQuestion.addButton')}
            >
              {t('serviceFlow.multiChoiceQuestion.addButton')}
            </Button>
          </Track>
          {buttons.length >= maxButtons && (
            <FormError style={{ marginTop: 2 }}>
              {t('serviceFlow.multiChoiceQuestion.maxButtonsStart')}
              {maxButtons}
              {t('serviceFlow.multiChoiceQuestion.maxButtonsEnd')}
            </FormError>
          )}
          {buttons.length < 2 && (
            <FormError style={{ marginTop: 2 }}>{t('serviceFlow.multiChoiceQuestion.minButtons')}</FormError>
          )}
        </div>
      </Track>
      {node && <PreviousVariables node={node} />}
    </Track>
  );
};

export default MultiChoiceQuestionContent;
