-- Exclui a inscrição cancelada "Venda Profit" (id confirmado no banco)
DELETE FROM payment      WHERE registration_id = 'a21c4312-4680-440d-9bd9-de19eeb977fe';
DELETE FROM registration WHERE id              = 'a21c4312-4680-440d-9bd9-de19eeb977fe';

-- (opcional) remove o atleta de teste se não tiver outras inscrições:
DELETE FROM athlete a
WHERE a.email = 'vendaprofit.app@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM registration r WHERE r.athlete_id = a.id);
