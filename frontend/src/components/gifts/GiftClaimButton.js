import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Gift, Loader2 } from 'lucide-react';

const GiftClaimButton = ({ giftId, coinsAmount, firesAmount, onClaimed }) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const queryClient = useQueryClient();

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/gifts/claim/${giftId}`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`🎉 ¡Regalo reclamado! +${coinsAmount}🪙 +${firesAmount}🔥`);
      queryClient.invalidateQueries(['bingo-messages']);
      queryClient.invalidateQueries(['wallet-balance']);
      if (onClaimed) onClaimed(data);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al reclamar regalo');
    }
  });

  const handleClaim = async () => {
    setIsClaiming(true);
    await claimMutation.mutateAsync();
    setIsClaiming(false);
  };

  return (
    <button
      onClick={handleClaim}
      disabled={isClaiming || claimMutation.isLoading}
      className="btn-primary w-full flex items-center justify-center gap-2 mt-3"
    >
      {isClaiming || claimMutation.isLoading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Reclamando...
        </>
      ) : (
        <>
          <Gift size={18} />
          Aceptar Regalo
        </>
      )}
    </button>
  );
};

export default GiftClaimButton;
