import React from "react";
import Card from "../atoms/Card";
import Badge from "../atoms/Badge";

import { FoodItem } from "../types/nutrition";

interface FoodCardProps {
  food: FoodItem;
}

const FoodCard: React.FC<FoodCardProps> = ({ food }) => {
  return (
    <Card className="hover:-translate-y-1 transition-transform duration-300">
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3
            className="text-lg font-bold text-slate-800 truncate pr-2"
            title={food.name}
          >
            {food.name}
          </h3>
          {food.confidence && (
            <Badge color={food.confidence > 90 ? "green" : "orange"}>
              {food.confidence}% Match
            </Badge>
          )}
        </div>

        {food.portion && (
          <p className="text-sm text-slate-500 mb-4">{food.portion}</p>
        )}

        <div className="mt-2 space-y-2">
          <div className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded-lg mb-2">
            <span className="text-slate-600 font-medium">Calories:</span>
            <span className="font-bold text-emerald-600 text-base">
              {food.calories} kcal
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-50 rounded p-1.5">
              <span className="block text-slate-400 mb-0.5">Protein</span>
              <span className="font-bold text-slate-700">{food.protein}g</span>
            </div>
            <div className="bg-slate-50 rounded p-1.5">
              <span className="block text-slate-400 mb-0.5">Carbs</span>
              <span className="font-bold text-slate-700">{food.carbs}g</span>
            </div>
            <div className="bg-slate-50 rounded p-1.5">
              <span className="block text-slate-400 mb-0.5">Fat</span>
              <span className="font-bold text-slate-700">{food.fats}g</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default FoodCard;
