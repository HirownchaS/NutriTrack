import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../atoms/Card";
import Button from "../atoms/Button";
import { FiUser, FiBriefcase, FiAward } from "react-icons/fi";
import { Nutritionist } from "../types/nutrition";

interface NutritionistCardProps {
  nutritionist: Nutritionist;
  status?: "none" | "pending" | "accepted" | "rejected";
  onSendRequest: (id: string | number) => void;
}

const NutritionistCard: React.FC<NutritionistCardProps> = ({
  nutritionist,
  status = "none",
  onSendRequest,
}) => {
  const isPending = status === "pending";
  const isAccepted = status === "accepted";
  const isRejected = status === "rejected";
  const navigate = useNavigate();

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow duration-300">
      {/* Header / Image Area */}
      <div className="relative h-48 bg-slate-100">
        <img
          src={nutritionist.image || "/assets/nutritionist-consultation.png"}
          alt={nutritionist.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content Area */}
      <div className="p-5 flex-grow flex flex-col">
        <h3 className="text-xl font-bold text-slate-800 mb-1">
          {nutritionist.name}
        </h3>

        <div className="space-y-2 mt-3 text-slate-600">
          <div className="flex items-center gap-2">
            <FiAward className="text-emerald-600" />
            <span className="text-sm">
              {{
                "lose weight": "Weight Loss",
                maintain: "Maintain Weight",
                "build muscle": "Muscle Building",
                "general health": "General Health",
              }[nutritionist.specialization.toLowerCase()] ||
                nutritionist.specialization}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBriefcase className="text-emerald-600" />
            <span className="text-sm">
              {nutritionist.experience} Experience
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiUser className="text-emerald-600" />
            <span className="text-sm tracking-tight">{nutritionist.email}</span>
          </div>
          {/* <div className="flex items-center gap-2">
                        <FiUser className="text-emerald-600 invisible" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{nutritionist.clients_count} Total Clients</span>
                    </div> */}
        </div>

        {/* Action Area */}
        <div className="mt-auto pt-6">
          {isAccepted ? (
            <Button
              variant="primary"
              className="w-full py-2.5 font-bold bg-blue-500 hover:bg-blue-600 focus:ring-blue-500 text-white shadow-md"
              onClick={() =>
                navigate("/dashboard/chat", {
                  state: {
                    recipientId: nutritionist.id,
                    recipientName: nutritionist.name,
                  },
                })
              }
            >
              Open Chat
            </Button>
          ) : isRejected ? (
            <div className="w-full py-2.5 bg-rose-50 text-rose-600 font-black rounded-xl text-center border border-rose-100 uppercase text-xs tracking-wider flex items-center justify-center gap-2">
              Rejected
            </div>
          ) : (
            <Button
              variant={isPending ? "secondary" : "primary"}
              className="w-full py-2.5 font-bold"
              onClick={() => !isPending && onSendRequest(nutritionist.id)}
              disabled={isPending}
            >
              {isPending ? "Pending" : "Send Request"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default NutritionistCard;
