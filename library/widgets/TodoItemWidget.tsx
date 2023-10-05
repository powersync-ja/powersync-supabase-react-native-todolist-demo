import React from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { ListItem, Button } from "react-native-elements";
import { TodoModel } from "../models/TodoModel";

export const TodoItemWidget: React.FC<{ model: TodoModel }> = (props) => {
  const { model } = props;
  const [loading, setLoading] = React.useState(false);

  return (
    <View style={{ padding: 10 }}>
      <ListItem.Swipeable
        bottomDivider
        key={`todo-item-${model.id}`}
        rightContent={
          <Button
            containerStyle={{
              flex: 1,
              justifyContent: "center",
              backgroundColor: "#d3d3d3",
            }}
            type="clear"
            icon={{ name: "delete", color: "red" }}
            onPress={() => {
              Alert.alert(
                "Confirm",
                "This item will be permanently deleted",
                [
                  { text: "Cancel" },
                  { text: "Delete", onPress: () => model.delete() },
                ],
                { cancelable: true }
              );
            }}
          />
        }
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <ListItem.CheckBox
            iconType="material-community"
            checkedIcon="checkbox-marked"
            uncheckedIcon="checkbox-blank-outline"
            checked={model.record.completed}
            onPress={async () => {
              setLoading(true);
              try {
                await model.toggleCompletion(!model.record.completed);
              } catch (ex) {
                console.error(ex);
              } finally {
                setLoading(false);
              }
            }}
          />
        )}
        <ListItem.Content style={{ minHeight: 80 }}>
          <ListItem.Title>{model.record.description}</ListItem.Title>
        </ListItem.Content>
      </ListItem.Swipeable>
    </View>
  );
};
