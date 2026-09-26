import { fireEvent, render, screen } from '@testing-library/react-native';

import { TopicRow } from './topic-row';
import { topicByKey } from './topics';

import type { AgreementTopicView } from '@/data';

const topic = topicByKey('dedicacion')!;
const at = '2026-09-24T10:00:00.000Z';
const answer = (option: string, note: string | null = null) => ({
  topic: 'dedicacion',
  option,
  note,
  updatedAt: at,
});
const row = (view: AgreementTopicView | undefined, onSave = jest.fn()) =>
  render(
    <TopicRow topic={topic} view={view} counterpartName="Núria" saving={false} onSave={onSave} />
  );

it('pendiente sin la mía: «Falta tu respuesta», aunque ella ya haya respondido', async () => {
  await row({ topic: 'dedicacion', mine: null, theirs: 'hidden' });
  expect(screen.getByText('Falta tu respuesta')).toBeTruthy();
  expect(screen.getByText('Núria ya ha respondido')).toBeTruthy();
});

it('pendiente con la mía: dice que falta la suya y enseña la mía', async () => {
  await row({ topic: 'dedicacion', mine: answer('completa'), theirs: null });
  expect(screen.getByText('Núria aún no ha respondido')).toBeTruthy();
  expect(screen.getByText('Tú: Jornada completa')).toBeTruthy();
});

it('coincidís: la opción común, con estado en texto', async () => {
  await row({ topic: 'dedicacion', mine: answer('completa'), theirs: answer('completa', 'Todo') });
  expect(screen.getByText('Coincidís')).toBeTruthy();
  expect(screen.getByText('Jornada completa')).toBeTruthy();
  expect(screen.getByText('Núria: «Todo»')).toBeTruthy();
});

it('distinto: las dos opciones, cada una con su nombre, y una etiqueta que las lee', async () => {
  await row({ topic: 'dedicacion', mine: answer('10-25h'), theirs: answer('completa') });
  expect(screen.getByText('Distinto')).toBeTruthy();
  expect(screen.getByText('Tú: Entre 10 y 25 h a la semana')).toBeTruthy();
  expect(screen.getByText('Núria: Jornada completa')).toBeTruthy();
  expect(
    screen.getByLabelText(
      /dedicar.*Distinto.*tú: Entre 10 y 25 h a la semana.*Núria: Jornada completa/
    )
  ).toBeTruthy();
});

it('por hablar: lo dice en texto', async () => {
  await row({ topic: 'dedicacion', mine: answer('sin-decidir'), theirs: answer('completa') });
  expect(screen.getByText('Lo tenéis que hablar')).toBeTruthy();
});

it('al tocar se despliega; elegir y guardar llama a onSave con la nota', async () => {
  const onSave = jest.fn();
  await row(undefined, onSave);

  await fireEvent.press(screen.getByText(topic.question));
  await fireEvent.press(screen.getByRole('radio', { name: 'Jornada completa' }));
  await fireEvent.changeText(screen.getByLabelText('Nota opcional'), 'Lo dejo todo');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar respuesta' }));

  expect(onSave).toHaveBeenCalledWith('completa', 'Lo dejo todo');
});

it('la nota tiene tope de 280 y sin opción elegida no se puede guardar', async () => {
  await row(undefined);
  await fireEvent.press(screen.getByText(topic.question));

  expect(screen.getByLabelText('Nota opcional').props.maxLength).toBe(280);
  expect(
    screen.getByRole('button', { name: 'Guardar respuesta' }).props.accessibilityState
  ).toMatchObject({ disabled: true });
});

it('una nota de solo espacios se guarda como null', async () => {
  const onSave = jest.fn();
  await row(undefined, onSave);
  await fireEvent.press(screen.getByText(topic.question));
  await fireEvent.press(screen.getByRole('radio', { name: 'Jornada completa' }));
  await fireEvent.changeText(screen.getByLabelText('Nota opcional'), '   ');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar respuesta' }));

  expect(onSave).toHaveBeenCalledWith('completa', null);
});

it('mi clave desconocida cuenta como no respondida, y el editor no la marca', async () => {
  await row({ topic: 'dedicacion', mine: answer('catalogo-viejo'), theirs: answer('completa') });
  expect(screen.getByText('Falta tu respuesta')).toBeTruthy();
  expect(screen.getByText('Núria ya ha respondido')).toBeTruthy();

  await fireEvent.press(screen.getByText(topic.question));
  expect(
    screen.getByRole('button', { name: 'Guardar respuesta' }).props.accessibilityState
  ).toMatchObject({ disabled: true });
});

it('el editor parte de mi respuesta aunque la vista llegue después del montaje', async () => {
  const onSave = jest.fn();
  await row(undefined, onSave);
  await screen.rerender(
    <TopicRow
      topic={topic}
      view={{ topic: 'dedicacion', mine: answer('completa', 'Todo'), theirs: null }}
      counterpartName="Núria"
      saving={false}
      onSave={onSave}
    />
  );

  await fireEvent.press(screen.getByText(topic.question));
  expect(
    screen.getByRole('radio', { name: 'Jornada completa' }).props.accessibilityState
  ).toMatchObject({ selected: true });
  expect(screen.getByLabelText('Nota opcional').props.value).toBe('Todo');
});

it('mientras se guarda, el botón está deshabilitado', async () => {
  await render(
    <TopicRow
      topic={topic}
      view={{ topic: 'dedicacion', mine: answer('completa'), theirs: null }}
      counterpartName="Núria"
      saving
      onSave={jest.fn()}
    />
  );
  await fireEvent.press(screen.getByText(topic.question));
  expect(
    screen.getByRole('button', { name: 'Guardar respuesta' }).props.accessibilityState
  ).toMatchObject({ disabled: true });
});
