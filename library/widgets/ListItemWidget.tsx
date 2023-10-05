import React from "react";
import { ListModel } from "../models/ListModel";
import { Alert, View } from "react-native";
import { ListItem, Icon, Button } from "react-native-elements";
import { router } from "expo-router";
import { observer } from 'mobx-react-lite';


export const ListItemWidget: React.FC<{
  model: ListModel;
}> = observer( (props) => {
  const { model } = props;
  return (
    <View key={`list-${model.id}`} style={{ padding: 10 }}>
      <ListItem.Swipeable
        bottomDivider
        onPress={() => {
          router.push({
            pathname: "views/todos/edit/[id]",
            params: { id: model.id },
          });
        }}
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
                "This list will be permanently deleted",
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
        <Icon
          name="format-list-checks"
          type="material-community"
          color="grey"
        />
        <ListItem.Content style={{ minHeight: 80 }}>
          <ListItem.Title>{model.record.name}</ListItem.Title>
          <ListItem.Subtitle style={{ color: "grey" }}>
            {model.description}
          </ListItem.Subtitle>
        </ListItem.Content>

        <ListItem.Chevron />
      </ListItem.Swipeable>
    </View>
  );
});
